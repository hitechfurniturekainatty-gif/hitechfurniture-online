import logo from "@/assets/hitech-logo.jpeg";
import { cn } from "@/lib/utils";

/** Display the supplied original wordmark, excluding only its empty margins.
 * Never recreate the lettering, recolour the orange dot, or clip it to a circle.
 */
export const Logo = ({ className }: { className?: string; rounded?: boolean }) => (
  <svg
    viewBox="75 480 1375 570"
    role="img"
    aria-label="Hitech Furniture & Interiors"
    className={cn("shrink-0 rounded-sm bg-white", className)}
  >
    <image href={logo} width="1536" height="1536" />
  </svg>
);
