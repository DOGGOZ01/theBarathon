"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { REACTION_GLYPHS, type ReactionEmoji, type ReactionSummary } from "@/lib/types";

const ALL_EMOJIS = Object.keys(REACTION_GLYPHS) as ReactionEmoji[];

interface ReactionBarProps {
  targetType: "review" | "comment";
  targetId: number;
  summary: ReactionSummary;
  onChange: (summary: ReactionSummary) => void;
}

export function ReactionBar({ targetType, targetId, summary, onChange }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function react(emoji: ReactionEmoji) {
    if (busy) return;
    setBusy(true);
    setPickerOpen(false);
    try {
      const path = targetType === "review" ? `/reviews/${targetId}/react/` : `/comments/${targetId}/react/`;
      const res = await api.post<ReactionSummary>(path, { emoji });
      onChange(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {summary.reactions_summary.map(({ emoji, count }) => {
        const mine = summary.my_reaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={busy}
            onClick={() => react(emoji)}
            className={`flex min-h-[32px] items-center gap-1 rounded-pill border-2 px-2 text-xs font-medium ${
              mine ? "border-ink bg-yellow" : "border-line bg-paper"
            }`}
          >
            <span>{REACTION_GLYPHS[emoji]}</span>
            <span>{count}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Ajouter une réaction"
        className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-pill border-2 border-line bg-paper px-2 text-xs text-ink-soft"
      >
        +
      </button>

      {pickerOpen && (
        <>
          <button aria-label="Fermer" className="fixed inset-0 z-[900]" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 z-[901] mb-1 flex gap-1 rounded-pill border-2 border-ink bg-paper-raised p-1.5 shadow-hard-sm">
            {ALL_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition active:scale-90"
              >
                {REACTION_GLYPHS[emoji]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
