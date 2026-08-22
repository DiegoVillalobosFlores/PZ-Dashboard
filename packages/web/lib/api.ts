// The frontend is served by whatever host exposes the API, so every request
// is same-origin and a bare relative path says exactly that. Building the URL
// from location.origin instead would depend on how each host spells its
// origin - the browser app also runs from file://, and opaque origins
// serialize as "null", which does not concatenate into a usable URL.
export function apiBase(): string {
  return "";
}

export function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}
