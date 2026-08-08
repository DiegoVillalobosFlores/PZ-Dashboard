// The frontend is now served by the same Bun server that exposes the API,
// so everything is same-origin - no port or protocol guessing needed.
export function apiBase(): string {
  return window.location.origin;
}

export function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}
