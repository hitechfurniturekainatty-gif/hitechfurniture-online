import logo from "@/assets/hitech-logo.jpeg";

export const Logo = ({ className = "h-12 w-auto" }: { className?: string }) => (
  <img
    src={logo}
    alt="Hitech Furniture & Interiors"
    className={className}
    loading="eager"
    decoding="async"
  />
);
