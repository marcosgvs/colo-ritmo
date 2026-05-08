export type IconName =
  | 'list'
  | 'people'
  | 'swap'
  | 'grid'
  | 'calendar'
  | 'radar'
  | 'hospital'
  | 'sparkle'
  | 'sync'
  | 'coin';

interface NavIconProps {
  name: IconName;
}

const props = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function NavIcon({ name }: NavIconProps) {
  switch (name) {
    case 'list':
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'people':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15 14.5c2-.5 6 .5 6 4" />
        </svg>
      );
    case 'swap':
      return (
        <svg {...props}>
          <path d="M7 7h13l-3-3M17 17H4l3 3" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
      );
    case 'radar':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <path d="M12 12L19 7" />
        </svg>
      );
    case 'hospital':
      return (
        <svg {...props}>
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M9 21v-6h6v6M12 11v3M10.5 12.5h3" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19" />
        </svg>
      );
    case 'sync':
      return (
        <svg {...props}>
          <path d="M21 12a9 9 0 01-15 6.7L3 16M3 12a9 9 0 0115-6.7L21 8" />
          <path d="M21 3v5h-5M3 21v-5h5" />
        </svg>
      );
    case 'coin':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9h4a2 2 0 010 4h-3a2 2 0 000 4h5" />
          <path d="M12 6v2M12 16v2" />
        </svg>
      );
  }
}
