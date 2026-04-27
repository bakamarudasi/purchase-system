import type { SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number;
}

const baseProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
});

export const FileText = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const X = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const Filter = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const Plus = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const TrendingUp = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const Clock = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const CheckCircle = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const BarChart3 = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

export const FileCheck = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);

export const ChevronUp = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

export const ChevronDown = ({ size = 24, className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...baseProps(size, className)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
