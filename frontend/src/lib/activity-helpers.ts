import type { ActivityItem } from "@/lib/types";

export function actionLabel(item: ActivityItem): string {
  if (item.type === "place") return `a ajouté ${item.place_name}`;
  if (item.type === "review") return `a laissé un avis sur ${item.place_name}`;
  return `a laissé un commentaire sur ${item.place_name}`;
}

/** Like actionLabel, without the leading username (e.g. on a profile page). */
export function actionLabelStandalone(item: ActivityItem): string {
  if (item.type === "place") return `Ajouté ${item.place_name}`;
  if (item.type === "review") return `Avis sur ${item.place_name}`;
  return `Commentaire sur ${item.place_name}`;
}

export function itemLink(item: ActivityItem): { href: string; label: string } {
  if (item.type === "place") {
    return { href: `/city/${item.city_id}?place=${item.place_id}`, label: "Voir sur la carte" };
  }
  if (item.type === "review") {
    return { href: `/place/${item.place_id}?focus=review-${item.id}&from=activity`, label: "Voir l'avis" };
  }
  return { href: `/place/${item.place_id}?focus=comment-${item.id}&from=activity`, label: "Voir le commentaire" };
}
