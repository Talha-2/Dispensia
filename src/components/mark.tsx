import { useId } from "react";

/**
 * The mark: a medical cross whose vertical arm is drawn as a capsule, with the
 * capsule's seam showing. Reads as healthcare at a glance and as dispensing on
 * a second look. Every edge lands on the 24-unit grid so it stays crisp from
 * 16px in a nav rail up to a sign-in page.
 */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  // A gradient id has to be unique per instance. Every Mark used to declare
  // `sd-mark`, so a second copy on the page resolved `url(#sd-mark)` to the
  // first definition in document order — and when that first copy sat inside a
  // hidden element, as the on-screen receipt does while the printed one is
  // rendering, the gradient did not paint and the logo came out blank.
  const gradient = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-deep)" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill={`url(#${gradient})`} />
      <rect width="24" height="24" rx="7" fill="none" stroke="rgb(255 255 255 / 0.22)" />
      {/* horizontal arm */}
      <rect x="4" y="10" width="16" height="4" rx="2" fill="var(--on-primary)" opacity="0.75" />
      {/* vertical arm, drawn as a capsule */}
      <rect x="10" y="4" width="4" height="16" rx="2" fill="var(--on-primary)" />
      {/* the capsule seam */}
      <rect x="10" y="11.4" width="4" height="1.2" fill="var(--primary-deep)" opacity="0.6" />
    </svg>
  );
}

export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex h-8 items-center justify-center" title="Dispensia">
        <Mark size={24} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Mark size={26} />
      <div className="leading-none">
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>
          Dispensia
        </div>
        <div className="mt-0.5" style={{ fontSize: 11, color: "var(--ink-3)" }}>
          Main Branch
        </div>
      </div>
    </div>
  );
}
