/**
 * Hitech logo — pure SVG so the orange/yellow dot sits precisely on top of
 * the 'i'. No JPEG dependency, scales crisply at any size, and uses brand
 * design tokens (text in primary, dot in accent).
 *
 * Sizes are controlled by `className` (height). Width is auto.
 */
export const Logo = ({
  className = "h-10 w-auto",
  showSubtitle = false,
}: {
  className?: string;
  showSubtitle?: boolean;
}) => {
  // viewBox tuned so 'h i t e c h' fits with a dot floating above the 'i'.
  // The dot is intentionally orange (#F59E0B) per brand rule, regardless of theme.
  const DOT_COLOR = "#F59E0B"; // orange/yellow

  return (
    <div className="flex items-center gap-2 leading-none">
      <svg
        viewBox="0 0 220 70"
        className={className}
        role="img"
        aria-label="Hitech Furniture and Interiors"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Brand wordmark — inherits color from currentColor (set via text-primary) */}
        <text
          x="0"
          y="52"
          fontFamily="Fraunces, Georgia, serif"
          fontSize="56"
          fontWeight="700"
          letterSpacing="-1"
          fill="currentColor"
        >
          h<tspan fill="currentColor">i</tspan>tech
        </text>
        {/* Orange/yellow dot precisely on top of the 'i' (the 'h' glyph is ~30 wide at this size). */}
        <circle cx="36" cy="14" r="7" fill={DOT_COLOR} />
      </svg>

      {showSubtitle && (
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
          Furniture & Interiors
        </span>
      )}
    </div>
  );
};
