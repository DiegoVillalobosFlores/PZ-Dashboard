export function healthColor(value: number): string {
  if (value >= 70) return 'var(--color-success)';
  if (value >= 40) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function vitalColor(value: number): string {
  if (value >= 60) return 'var(--color-text-secondary)';
  if (value >= 30) return 'var(--color-warning)';
  return 'var(--color-danger)';
}
