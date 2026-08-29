import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import type { User } from "@/lib/types";

const PALETTE = ["#ffc629", "#ff8a5c", "#6fcf97", "#56ccf2", "#bb6bd9", "#f2994a"];

function colorFor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface AvatarProps {
  user: User | null;
  size?: number;
}

export function Avatar({ user, size = 32 }: AvatarProps) {
  const src = user ? mediaUrl(user.avatar) : null;
  const style = { width: size, height: size };

  if (src) {
    return (
      <span
        className="relative inline-block shrink-0 overflow-hidden rounded-full border-2 border-ink"
        style={style}
      >
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-display text-ink"
      style={{ ...style, background: colorFor(user?.username ?? "?"), fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
