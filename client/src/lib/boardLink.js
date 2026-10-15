// Accepts either a bare board ID or a full board URL, and returns the ID
// (the last part of the path), e.g. "http://host/board/abc123" -> "abc123".
export function extractBoardId(input) {
  const text = input.trim();
  let path = text;
  try {
    path = new URL(text).pathname;
  } catch {
    // Not a full URL; treat it as an ID or a path.
  }
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
