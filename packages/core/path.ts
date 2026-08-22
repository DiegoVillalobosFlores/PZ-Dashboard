export function joinPath(...parts: string[]): string {
  const raw = parts.filter(Boolean).map((part) => part.replaceAll("\\", "/")).join("/");
  if (!raw) return ".";

  const drive = /^[A-Za-z]:/.test(raw) ? raw.slice(0, 2) : "";
  const body = drive ? raw.slice(2) : raw;
  const absolute = body.startsWith("/");
  const segments: string[] = [];

  for (const segment of body.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length && segments[segments.length - 1] !== "..") segments.pop();
      else if (!absolute) segments.push(segment);
      continue;
    }
    segments.push(segment);
  }

  const prefix = drive ? `${drive}/` : absolute ? "/" : "";
  return `${prefix}${segments.join("/")}` || (absolute ? prefix : ".");
}

export function basename(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function normalizePath(path: string): string {
  return joinPath(path);
}
