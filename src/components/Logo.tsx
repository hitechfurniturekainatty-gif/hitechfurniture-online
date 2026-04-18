import { forwardRef } from "react";
import logo from "@/assets/hitech-logo.jpeg";

export const Logo = forwardRef<HTMLImageElement, { className?: string }>(
  ({ className = "h-10 w-auto" }, ref) => (
    <img ref={ref} src={logo} alt="My Hitech" className={className} loading="eager" />
  )
);
Logo.displayName = "Logo";
