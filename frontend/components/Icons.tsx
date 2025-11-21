import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const PoolsIcon = ({ className, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Interesting oscillator: A wave that loops back on itself or has a 'kink' */}
    <path d="M2 12c0-4 2-7 6-7 2 0 3 2 4 4s2 4 4 4c4 0 6-3 6-7" /> {/* Base wave */}
    <path d="M16 5c0 3 2 5 5 5" /> {/* Upper tail */}
    <path d="M2 12c2 3 4 5 7 5 4 0 5-3 6-5" /> {/* Lower interference pattern */}
    <circle cx="18" cy="18" r="2" /> {/* A 'point' of interest/oscillation node */}
  </svg>
);

export const CreateIcon = ({ className, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* "Magic Wand" creating a "Market Pulse" */}
    {/* Vertical: A smooth, straight wand/tool (Order/Control) */}
    <path d="M12 8v13" />
    <circle cx="12" cy="5" r="2.5" />

    {/* Horizontal: An asymmetrical, jagged pulse wave (Chaos/Market) */}
    {/* Forms a 'Plus' shape indicating creation */}
    <path d="M3 13l4-4l5 6l5-5l4 3" />
  </svg>
);

export const SwapIcon = ({ className, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Sinuous intertwined curves/tails */}
    <path d="M8 5c-2.5 0-5 2.5-5 5s2.5 5 5 5h8" />
    <path d="M16 15l4-4-4-4" />
    <path d="M16 19c2.5 0 5-2.5 5-5s-2.5-5-5-5H8" />
    <path d="M8 9l-4 4 4 4" />
  </svg>
);

export const LiquidityIcon = ({ className, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Droplet with a piercing/ring */}
    <path d="M12 22c4.418 0 8-3.582 8-8 0-4.418-8-12-8-12S4 9.582 4 14c0 4.418 3.582 8 8 8z" />
    <path d="M12 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /> {/* The 'piercing' hole */}
    <path d="M12 18v2" />
    <circle cx="12" cy="21" r="1" fill="currentColor" />
  </svg>
);

export const FaucetIcon = ({ className, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Spigot with a drop */}
    <path d="M5 10h4v-2H5z" />
    <path d="M9 10v6h6v-6" />
    <path d="M15 10h4v-2h-4z" />
    <path d="M12 16v3" />
    <path d="M12 4v6" />
    <path d="M8 4h8" />
    <path d="M12 22c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" /> {/* Drop */}
  </svg>
);

