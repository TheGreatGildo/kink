'use client';

import { getTokenInfo } from '../lib/tokens';

interface TokenLogoProps {
  address: string | undefined;
  size?: number;
  className?: string;
}

export function TokenLogo({ address, size = 32, className }: TokenLogoProps) {
  if (!address) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted text-xs font-mono ${className}`}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  const token = getTokenInfo(address);

  if (token?.logo) {
    // Remove XML declaration and clean up SVG for data URL
    let cleanSvg = token.logo;
    // Remove XML declaration if present
    cleanSvg = cleanSvg.replace(/<\?xml[^>]*\?>/g, '');
    // Remove any leading/trailing whitespace
    cleanSvg = cleanSvg.trim();

    // Use base64 encoding for better compatibility
    try {
      const base64Svg = btoa(unescape(encodeURIComponent(cleanSvg)));
      const svgDataUrl = `data:image/svg+xml;base64,${base64Svg}`;

      return (
        <img
          src={svgDataUrl}
          alt={token.symbol}
          className={className}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'contain',
            display: 'block'
          }}
          onError={(e) => {
            // If image fails, hide it and show fallback
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    } catch (e) {
      // If base64 encoding fails, try URL encoding
      const encodedSvg = encodeURIComponent(cleanSvg);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

      return (
        <img
          src={svgDataUrl}
          alt={token.symbol}
          className={className}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'contain',
            display: 'block'
          }}
        />
      );
    }
  }

  // Fallback: show first few characters of address
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-muted text-xs font-mono ${className}`}
      style={{ width: size, height: size }}
    >
      {address.slice(2, 6).toUpperCase()}
    </div>
  );
}

