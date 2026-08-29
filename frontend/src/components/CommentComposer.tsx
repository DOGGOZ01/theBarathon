"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Comment } from "@/lib/types";

const MAX_PHOTOS = 3;

type Target = { type: "review"; id: number } | { type: "comment"; id: number };

interface CommentComposerProps {
  target: Target;
  onSaved: () => void;
  onCancel?: () => void;
}

export function CommentComposer({ target, onSaved, onCancel }: CommentComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slotsLeft = MAX_PHOTOS - files.length;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const picked = Array.from(fileList).slice(0, slotsLeft);
    setFiles((prev) => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim() && files.length === 0) {
      setError("Écrivez un message ou ajoutez une photo");
      return;
    }
    setBusy(true);
    try {
      const path = target.type === "review" ? `/reviews/${target.id}/comments/` : `/comments/${target.id}/replies/`;
      const comment = await api.post<Comment>(path, { text });

      let remaining = files;
      while (remaining.length > 0) {
        const [file, ...rest] = remaining;
        const fd = new FormData();
        fd.append("image", file);
        await api.post(`/comments/${comment.id}/photos/`, fd);
        remaining = rest;
        setFiles(remaining);
      }

      setText("");
      setFiles([]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le commentaire");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-block border-2 border-ink bg-paper p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Votre réponse…"
        rows={2}
        className="rounded-block border-2 border-ink bg-paper-raised px-2.5 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        {files.map((file, idx) => (
          <div key={idx} className="relative h-12 w-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(file)}
              alt=""
              className="h-full w-full rounded-block border-2 border-ink object-cover"
            />
            <button
              type="button"
              onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
              aria-label="Retirer la photo"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-paper bg-ink text-[10px] text-paper"
            >
              ✕
            </button>
          </div>
        ))}
        {slotsLeft > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-12 w-12 flex-col items-center justify-center rounded-block border-2 border-dashed border-ink-soft text-ink-soft"
          >
            <span className="text-lg leading-none">+</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />

        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[36px] rounded-block border-2 border-ink bg-paper px-3 text-xs font-medium"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="min-h-[36px] rounded-block border-2 border-ink bg-yellow px-3 text-xs font-semibold disabled:opacity-60"
          >
            {busy ? "…" : "Envoyer"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </form>
  );
}
