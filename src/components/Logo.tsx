// Plumbline Jury mark: a plumb bob hanging true from its line, its tip on the
// mark — the builder's check that something is straight. Same drawing as src/app/icon.svg.

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Plumbline Jury">
      <rect width="32" height="32" rx="8" fill="#1c1917" />
      <path d="M16 0v11" stroke="#fbf8f4" strokeWidth="1.5" />
      <path d="M14 11h4l4.5 5.5L16 25l-6.5-8.5Z" fill="#fb923c" />
      <path d="M16 11h2l4.5 5.5L16 25Z" fill="#ea580c" />
      <path d="M12.5 27.5h7" stroke="#fbf8f4" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
