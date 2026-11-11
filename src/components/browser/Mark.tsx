export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--color-ink)" />
      <circle cx="14.2" cy="16.2" r="7.4" fill="var(--color-primary)" />
      <path d="M19.4 14.4h7.2c1.15 0 1.9.75 1.9 1.75s-.75 1.75-1.9 1.75h-7.2z" fill="var(--color-bill)" />
      <circle cx="12.1" cy="14.3" r="1.45" fill="var(--color-bg)" />
    </svg>
  );
}
