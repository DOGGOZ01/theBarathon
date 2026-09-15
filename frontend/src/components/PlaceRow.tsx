import Image from "next/image";
import Link from "next/link";
import { mediaUrl } from "@/lib/api";
import { PLACE_TYPE_LABELS, type Place } from "@/lib/types";

export function PlaceRow({ place }: { place: Place }) {
  const photo = mediaUrl(place.photo);
  return (
    <Link
      href={`/place/${place.id}`}
      className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-block border-2 border-ink bg-ink">
        {photo && <Image src={photo} alt="" fill sizes="56px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{place.name}</p>
        <p className="text-xs text-ink-soft">
          {PLACE_TYPE_LABELS[place.place_type]}
          {place.place_type === "evenement" && place.event_date && (
            <> · {new Date(place.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</>
          )}
        </p>
      </div>
      <div className="shrink-0 rounded-block border-2 border-ink bg-yellow px-2 py-1 text-center">
        <p className="font-display text-sm leading-none">{Number(place.avg_overall).toFixed(1)}</p>
      </div>
    </Link>
  );
}
