import { config } from "@/config";

/** Neutral target mark. Branding comes from config, not from any real association's logo. */
export function Logo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="4" fill="var(--brand-orange)" />
        <path d="M20 0v8M20 32v8M0 20h8M32 20h8" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      {withText && (
        <span className="logo-text">
          <strong>{config.associationName}</strong>
          <small>Shooter ID Portal</small>
        </span>
      )}
    </span>
  );
}
