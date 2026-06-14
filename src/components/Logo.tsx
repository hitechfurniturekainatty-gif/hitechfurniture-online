import logo from "@/assets/hitech-logo.jpeg";
import { cn } from "@/lib/utils";

export const Logo = ({
  className,
  rounded = true,
}: {
  className?: string;
  rounded?: boolean;
}) => (
  <img
    src={logo}
    alt="Hitech Furniture & Interiors"
    className={cn(rounded && "rounded-full", className)}
    loading="eager"
    decoding="async"
  />
);
