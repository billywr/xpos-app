import { useId } from "react";

export interface ItemDummyBackgroundProps {
  className?: string;
  showBadge?: boolean;
  brandName?: string;
}

/**
 * Renders the dark ambient glow canvas and decorative grid from the dummy POS item image.
 * Uses unique SVG gradient IDs via React useId() to avoid ID collisions when multiple cards are rendered.
 */
export function ItemDummyBackground({
  className = "absolute inset-0 h-full w-full pointer-events-none",
  showBadge = true,
  brandName = "STONE PUB",
}: ItemDummyBackgroundProps) {
  const rawId = useId();
  const idPrefix = rawId.replace(/[:]/g, "");
  const bgGradId = `bgGrad-${idPrefix}`;
  const amberGlowId = `amberGlow-${idPrefix}`;

  const cleanBrand = (brandName || "STONE PUB").trim().toUpperCase();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 250"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>
        <radialGradient id={amberGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#d97706" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background Canvas */}
      <rect width="400" height="250" fill={`url(#${bgGradId})`} />

      {/* Center Ambient Radial Glow */}
      <ellipse cx="200" cy="115" rx="140" ry="90" fill={`url(#${amberGlowId})`} />

      {/* Subtle Decorative Grid Lines */}
      <g stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1">
        <line x1="0" y1="180" x2="400" y2="180" />
        <circle cx="200" cy="115" r="70" fill="none" strokeDasharray="4,4" />
      </g>

      {/* Product Silhouette / Ground Shadow */}
      <ellipse cx="200" cy="160" rx="75" ry="12" fill="#000000" fillOpacity="0.35" />

      {/* Brand Stamp Badge */}
      {showBadge && (
        <g transform="translate(200, 205)">
          <rect
            x="-75"
            y="-14"
            width="150"
            height="24"
            rx="12"
            fill="#1e293b"
            fillOpacity="0.85"
            stroke="#f59e0b"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <circle cx="-58" cy="-2" r="3" fill="#f59e0b" />
          <text
            x="0"
            y="2"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontSize="10"
            fontWeight="700"
            fill="#f8fafc"
            letterSpacing="1.5"
            textAnchor="middle"
          >
            {cleanBrand.length > 18 ? `${cleanBrand.slice(0, 16)}…` : cleanBrand}
          </text>
          <circle cx="58" cy="-2" r="3" fill="#f59e0b" />
        </g>
      )}
    </svg>
  );
}
