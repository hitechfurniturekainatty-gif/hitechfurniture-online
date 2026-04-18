import logo from "@/assets/hitech-logo.jpeg";

export const Logo = ({ className = "h-10 w-auto" }: { className?: string }) => (
  <img src={logo} alt="My Hitech" className={className} loading="eager" />
);
