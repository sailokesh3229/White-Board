param(
  [string]$Location = 'eastasia',
  [string]$ResourceGroup = 'folio-project',
  [string]$AppName = 'folio-lokesh-20261026'
)
$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localPath = Join-Path $repoPath '.local'
New-Item -ItemType Directory -Path $localPath -Force | Out-Null
$azPath = Join-Path $localPath 'azure-cli/bin/az.cmd'
if (!(Test-Path -LiteralPath $azPath)) { $azPath = (Get-Command az -ErrorAction Stop).Source }
$env:AZURE_CONFIG_DIR = Join-Path $localPath 'azure'
$env:AZURE_CORE_ENABLE_BROKER_ON_WINDOWS = 'false'
function Invoke-Azure {
  & $azPath @args
  if ($LASTEXITCODE -ne 0) { throw 'Azure command failed. No paid tier was requested.' }
}
$account = Invoke-Azure account show --output json | ConvertFrom-Json
if ($account.state -ne 'Enabled') { throw 'Sign in to an enabled Azure subscription first.' }
$mongoUri = $env:MONGODB_URI
if (!$mongoUri) {
  $envFile = Join-Path $repoPath 'server/.env'
  $mongoLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^MONGODB_URI=' } | Select-Object -First 1
  if ($mongoLine) { $mongoUri = $mongoLine.Substring(12).Trim().Trim('"').Trim("'") }
}
if (!$mongoUri -or $mongoUri -match '(localhost|127\.0\.0\.1)' -or $mongoUri -notmatch '^mongodb(\+srv)?://') { throw 'Set the Atlas MONGODB_URI in server/.env before deploying. It will not be printed.' }
Write-Output "Deploying to Azure subscription: $($account.name). Hosting tier: F1 Free."
$groupExists = Invoke-Azure group exists --name $ResourceGroup --output tsv
if ($groupExists -ne 'true') { Invoke-Azure group create --name $ResourceGroup --location $Location --output none }
Invoke-Azure appservice plan create --resource-group $ResourceGroup --name 'folio-free-plan' --is-linux --sku F1 --location $Location --output none
Invoke-Azure webapp create --resource-group $ResourceGroup --plan 'folio-free-plan' --name $AppName --runtime 'NODE:22-lts' --https-only true --output none
Invoke-Azure webapp config set --resource-group $ResourceGroup --name $AppName --web-sockets-enabled true --startup-file 'npm start' --output none
$settingsPath = Join-Path $localPath 'azure-appsettings.json'
$settings = @{ NODE_ENV='production'; MONGODB_URI=$mongoUri; SCM_DO_BUILD_DURING_DEPLOYMENT='true'; VITE_SERVER_URL=''; COOKIE_SAME_SITE='lax'; WEBSITE_NODE_DEFAULT_VERSION='~22' }
try {
  $settings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding utf8
  Invoke-Azure webapp config appsettings set --resource-group $ResourceGroup --name $AppName --settings "@$settingsPath" --output none
} finally { if(Test-Path -LiteralPath $settingsPath) { Remove-Item -LiteralPath $settingsPath -Force } }
$archivePath = Join-Path $localPath 'folio-source.zip'
git -C $repoPath archive --format zip --output $archivePath HEAD
if ($LASTEXITCODE -ne 0) { throw 'Could not package the committed project.' }
Invoke-Azure webapp deploy --resource-group $ResourceGroup --name $AppName --type zip --src-path $archivePath --async true --output none
$hostName = Invoke-Azure webapp show --resource-group $ResourceGroup --name $AppName --query defaultHostName --output tsv
Write-Output "Azure deployment submitted. App URL: https://$hostName"
