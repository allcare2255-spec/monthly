interface Props {
  size?: number;
  className?: string;
}

export default function SkyMateLogo({ size = 48, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <polygon points="50,5 72,22 64,22 50,13 36,22 28,22" fill="url(#skyGrad)" />
      <polygon points="28,22 36,22 36,46 28,40" fill="url(#skyGrad)" />
      <polygon points="36,38 50,38 50,46 36,46" fill="url(#skyGrad)" />
      <polygon points="50,54 64,54 64,62 50,62" fill="url(#skyGrad)" />
      <polygon points="72,60 64,60 64,78 72,78" fill="url(#skyGrad)" />
      <polygon points="50,95 28,78 36,78 50,87 64,78 72,78" fill="url(#skyGrad)" />
    </svg>
  );
}
