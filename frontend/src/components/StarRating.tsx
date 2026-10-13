"use client";

// Hand-drawn, slightly irregular star outline.
const STAR_PATH =
  "M12.4 1.6c.3-.7 1.1-.9 1.6-.3.9 1.1 2.1 3.5 2.7 5.4.2.6.7 1 1.3 1.1 2 .3 4.5 1 5.8 1.8.7.4.7 1.4-.1 1.8-1.5.8-3.9 1.9-5.7 2.4-.6.2-1 .7-1.1 1.3-.3 1.9-1 4.5-1.9 6.2-.4.7-1.3.8-1.8.1-1.1-1.5-2.6-3.8-3.3-5.6-.2-.6-.7-1-1.4-1.1-2-.2-4.9-.7-6.6-1.4-.8-.3-.9-1.3-.2-1.8 1.6-1.1 4.1-2.6 6-3.2.6-.2 1.1-.7 1.2-1.4C9.2 5.3 10.9 2.8 12.4 1.6z";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
  onChange?: (value: number) => void;
  label?: string;
}

export function StarRating({ value, max = 5, size = 22, onChange, label }: StarRatingProps) {
  const interactive = typeof onChange === "function";
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="inline-flex items-center gap-1" role={interactive ? "radiogroup" : "img"} aria-label={label ?? `${value} sur ${max}`}>
      {stars.map((n) => {
        const fillPct = Math.max(0, Math.min(1, value - (n - 1))) * 100;
        const Wrapper = interactive ? "button" : "span";
        return (
          <Wrapper
            key={n}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onChange!(n) : undefined}
            aria-label={interactive ? `Noter ${n} sur ${max}` : undefined}
            aria-checked={interactive ? value === n : undefined}
            role={interactive ? "radio" : undefined}
            className={interactive ? "p-1 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center" : "relative inline-block"}
            style={!interactive ? { width: size, height: size } : undefined}
          >
            <span className="relative inline-block" style={{ width: size, height: size }}>
              <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0">
                <path d={STAR_PATH} fill="var(--color-paper-raised)" stroke="var(--color-ink)" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span
                className="absolute inset-0 overflow-hidden transition-[width] duration-200 ease-out"
                style={{ width: `${fillPct}%` }}
              >
                <svg viewBox="0 0 24 24" width={size} height={size}>
                  <path d={STAR_PATH} fill="var(--color-yellow)" stroke="var(--color-ink)" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
          </Wrapper>
        );
      })}
    </div>
  );
}
