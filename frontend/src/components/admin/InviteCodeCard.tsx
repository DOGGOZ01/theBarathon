"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { InviteConfig } from "@/lib/types";

export function InviteCodeCard() {
  const [invite, setInvite] = useState<InviteConfig | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<InviteConfig>("/admin/invite-code/").then(setInvite).catch(() => {});
  }, []);

  async function regenerate() {
    setBusy(true);
    try {
      const fresh = await api.post<InviteConfig>("/admin/invite-code/regenerate/");
      setInvite(fresh);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  async function copy() {
    if (!invite) return;
    const ok = await copyToClipboard(invite.code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <section className="rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard">
      <h2 className="mb-2 font-display text-base">Code d&apos;invitation</h2>
      <p className="mb-3 text-sm text-ink-soft">Un seul code pour tout le monde. La régénération désactive l&apos;ancien immédiatement.</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="min-h-[44px] flex-1 truncate rounded-block border-2 border-ink bg-yellow-pale px-3 py-2 text-left font-mono text-sm tracking-wide"
        >
          {invite?.code ?? "…"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink bg-paper text-xs font-medium"
        >
          {copied ? (
            <span key="check" className="anim-pop-in inline-block">
              ✓
            </span>
          ) : (
            "copier"
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="mt-3 min-h-[44px] w-full rounded-block border-2 border-ink bg-ink font-medium text-paper shadow-hard-sm"
      >
        Régénérer le code
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Régénérer le code ?"
        description="L'ancien code cessera de fonctionner immédiatement. Transmettez le nouveau code à ceux qui ne sont pas encore inscrits."
        confirmLabel="Régénérer"
        busy={busy}
        onConfirm={regenerate}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
