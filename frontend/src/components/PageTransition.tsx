"use client";

import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Keying by pathname forces a remount (and so a fresh animation play) on
  // every navigation — plain children swaps wouldn't retrigger the CSS animation.
  //
  // Deliberately opacity-only (anim-fade-in), NOT anim-fade-in-up: a
  // transform-based animation on this wrapper would make it a containing
  // block for every `position: fixed` descendant (page pickers/sheets like
  // MapPickerOverlay), trapping them inside its box instead of the real
  // viewport — and since this div has no explicit z-index while BottomNav
  // has z-40, BottomNav would then paint over those "trapped" overlays.
  // opacity does not create that containing block, so it's safe here.
  return (
    <div key={pathname} className="anim-fade-in flex-1 pb-[76px]">
      {children}
    </div>
  );
}
