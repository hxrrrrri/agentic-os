interface AgenticOsLogoProps {
  className?: string;
}

export function AgenticOsLogo({ className = "h-9 w-9" }: AgenticOsLogoProps) {
  return (
    <img
      src="/agenticos-logo.png"
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
