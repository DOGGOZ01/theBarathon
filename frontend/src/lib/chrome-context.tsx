"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ChromeState {
  hideBottomNav: boolean;
  pushHideBottomNav: () => void;
  popHideBottomNav: () => void;
}

const ChromeContext = createContext<ChromeState | null>(null);

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  // Reference-counted so two overlapping "hide" requests (unlikely in
  // practice, but cheap to get right) don't reveal the nav the moment
  // just one of them unmounts.
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

/** Hides BottomNav for as long as the calling component stays mounted —
 * e.g. a full-screen map picker shouldn't compete with the bottom nav for
 * the same strip of screen. Restores it on unmount. */
export function useHideBottomNav() {
  const { pushHideBottomNav, popHideBottomNav } = useChrome();

  useEffect(() => {
    pushHideBottomNav();
    return () => popHideBottomNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- push/pop are stable (useCallback with no deps)
  }, []);
}
