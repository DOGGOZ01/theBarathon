import Link from "next/link";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import type { City } from "@/lib/types";

export function CityCard({ city }: { city: City }) {
  const photo = mediaUrl(city.photo);
  return (
    <Link
      href={`/city/${city.id}`}
      className="group relative block aspect-[16/10] overflow-hidden rounded-card border-2 border-ink bg-ink shadow-hard transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      {photo ? (
        <Image src={photo} alt={city.name} fill sizes="480px" className="object-cover opacity-90 transition group-active:opacity-75" />
      ) : (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-ink)_0,var(--color-ink)_2px,transparent_2px,transparent_14px)] opacity-60" />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <div>
          <p className="font-display text-lg leading-tight text-paper">{city.name}</p>
          <p className="text-xs text-paper/70">{city.country}</p>
        </div>
      </div>
    </Link>
  );
}
