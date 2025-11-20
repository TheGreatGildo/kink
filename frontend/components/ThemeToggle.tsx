'use client';

import { MonitorCog, Moon, SunMedium } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { useTheme } from './providers/ThemeProvider';
import { Button } from './ui/button';

const MODES = [
  { id: 'light', label: 'Light', icon: SunMedium },
  { id: 'system', label: 'Auto', icon: MonitorCog },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { currentTheme, handleModeToggle } = useTheme();

  return (
    <div
      className={cn(
        'layered-shadow flex items-center gap-1 rounded-2xl border border-border bg-card/90 p-1 text-xs backdrop-blur-lg dark:bg-background/80',
        className,
      )}
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentTheme === mode.id;
        return (
          <Button
            key={mode.id}
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide transition-colors',
              isActive
                ? 'bg-primary/90 text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => handleModeToggle(mode.id)}
            aria-pressed={isActive}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

