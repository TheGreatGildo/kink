'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  currentTheme: ThemeMode;
  handleModeToggle: (mode: ThemeMode) => void;
  isDarkMode: boolean;
}

const STORAGE_KEY = 'kinkdex-theme';

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: 'system',
  handleModeToggle: () => {},
  isDarkMode: false,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentTheme === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, currentTheme);
    }
  }, [currentTheme]);

  const isDarkMode = useMemo(() => {
    return (
      currentTheme === 'dark' ||
      (currentTheme === 'system' && systemPrefersDark)
    );
  }, [currentTheme, systemPrefersDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'milady');
    root.style.setProperty('color-scheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleModeToggle = useCallback((mode: ThemeMode) => {
    setCurrentTheme(mode);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        handleModeToggle,
        isDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

