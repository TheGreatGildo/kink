'use client';

import Image from 'next/image';
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
    const cleanSvg = token.logo.replace(/<\?xml[^>]*\?>/g, '').trim();
    let svgDataUrl: string | null = null;

    try {
      const base64Svg = btoa(unescape(encodeURIComponent(cleanSvg)));
      svgDataUrl = `data:image/svg+xml;base64,${base64Svg}`;
    } catch {
      const encodedSvg = encodeURIComponent(cleanSvg);
      svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
    }

    if (svgDataUrl) {
      return (
        <Image
          src={svgDataUrl}
          alt={token.symbol}
          width={size}
          height={size}
          className={className}
          style={{
            borderRadius: '50%',
            objectFit: 'contain',
            display: 'block',
          }}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          unoptimized
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

