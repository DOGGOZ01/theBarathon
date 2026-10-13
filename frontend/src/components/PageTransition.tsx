"use client";

import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Keyed by pathname so the animation replays on every navigation.
  // Opacity only: a transform would trap position:fixed overlays inside this wrapper.
  return (
    <div key={pathname} className="anim-fade-in flex-1 pb-[76px]">
      {children}
    </div>
  );
}
