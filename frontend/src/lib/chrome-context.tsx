"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ChromeState {
  hideBottomNav: boolean;
  pushHideBottomNav: () => void;
  popHideBottomNav: () => void;
}

const ChromeContext = createContext<ChromeState | null>(null);

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  // Reference-counted so overlapping hide requests don't show the nav too early.
  const [hideCount, setHideCount] = useState(0);

  const pushHideBottomNav = useCallback(() => setHideCount((n) => n + 1), []);
  const popHideBottomNav = useCallback(() => setHideCount((n) => Math.max(0, n - 1)), []);

  return (
    <ChromeContext.Provider value={{ hideBottomNav: hideCount > 0, pushHideBottomNav, popHideBottomNav }}>
      {children}
    </ChromeContext.Provider>
  );
}

export function useChrome() {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error("useChrome must be used within ChromeProvider");
  return ctx;
}

/** Hides BottomNav while the calling component is mounted. */
export function useHideBottomNav() {
  const { pushHideBottomNav, popHideBottomNav } = useChrome();

  useEffect(() => {
    pushHideBottomNav();
    return () => popHideBottomNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- push/pop are stable (useCallback with no deps)
  }, []);
}
