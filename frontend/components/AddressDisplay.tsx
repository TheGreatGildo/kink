'use client';

import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { cn } from '../lib/utils/cn';

interface AddressDisplayProps {
  address: string;
  className?: string;
  showFull?: boolean;
  prefix?: string;
  startChars?: number;
  endChars?: number;
}

export function AddressDisplay({
  address,
  className,
  showFull = false,
  prefix,
  startChars = 6,
  endChars = 4
}: AddressDisplayProps) {
  const { copied, copyToClipboard } = useCopyToClipboard();

  const displayAddress = showFull
    ? address
    : `${address.slice(0, startChars)}...${address.slice(-endChars)}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(address);
  };

  return (
    <span className="relative inline-flex items-center">
      <code
        onClick={handleClick}
        className={cn(
          'cursor-pointer hover:opacity-80 transition-opacity font-mono select-none',
          className
        )}
        title="Click to copy address"
      >
        {prefix && <span className="mr-1">{prefix}</span>}
        {displayAddress}
      </code>
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50 shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
          ✓ Copied!
        </span>
      )}
    </span>
  );
}

