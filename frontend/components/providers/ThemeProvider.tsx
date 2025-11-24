'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  currentTheme: ThemeMode;
  handleModeToggle: (mode: ThemeMode) => void;
  isDarkMode: boolean;
}

const STORAGE_KEY = 'kinkdex-theme';

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: 'dark',
  handleModeToggle: () => {},
  isDarkMode: true,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, currentTheme);
  }, [currentTheme]);

  const isDarkMode = useMemo(() => currentTheme === 'dark', [currentTheme]);

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

