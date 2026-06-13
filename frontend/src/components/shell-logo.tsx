interface ShellLogoProps {
  size?: number
  className?: string
}

export function ShellLogo({ size = 24, className }: ShellLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="8" cy="8" r="6" />
      <circle cx="18" cy="18" r="6" />
      <path d="M12 18a6 6 0 0 0-6-6" />
      <path d="M18 12a6 6 0 0 0-6-6" />
    </svg>
  )
}
