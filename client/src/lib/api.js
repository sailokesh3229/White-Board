export const API_URL = (import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? "http://localhost:4000" : location.origin)).replace(/\/$/, "");
export async function accountRequest(path, body) {
  const response = await fetch(`${API_URL}/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not reach your account. Please retry.");
  return result;
}
