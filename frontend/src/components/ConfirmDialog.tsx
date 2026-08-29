"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <button aria-label="Fermer" className="absolute inset-0 bg-ink/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-card border-2 border-ink bg-paper-raised p-5 shadow-hard">
        <p className="font-display text-lg">{title}</p>
        {description && <p className="mt-2 text-sm text-ink-soft">{description}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-block border-2 border-ink bg-paper font-medium"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-block border-2 border-ink bg-bad font-medium text-paper shadow-hard-sm disabled:opacity-60"
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
