/**
 * Indeterminate activity indicator.
 *
 * Purely decorative: `aria-hidden`, with no accessible name of its own. Every
 * caller pairs it with visible status text ("Importing… 12 / 250"), and that
 * text — inside a `role="status"` region — is what assistive technology
 * announces. Giving the glyph its own label would announce the same state
 * twice.
 *
 * The rotation is defined in main.css and is removed under
 * `prefers-reduced-motion: reduce`; the ring still renders, and the paired text
 * carries the meaning. This is the codebase's first keyframe animation, so the
 * pattern is established here rather than inherited.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={className ? `spinner ${className}` : "spinner"}
      aria-hidden="true"
    />
  );
}
