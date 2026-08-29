import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { actionLabel, actionLabelStandalone, itemLink } from "@/lib/activity-helpers";
import type { ActivityItem } from "@/lib/types";

interface ActivityRowProps {
  item: ActivityItem;
  /** Hide the actor's name/avatar — useful when every row already belongs to
   * the same person (e.g. on that person's own profile page). */
  hideActor?: boolean;
}

export function ActivityRow({ item, hideActor }: ActivityRowProps) {
  const { href, label } = itemLink(item);

  return (
    <div className="flex items-start gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm">
      {!hideActor && <Avatar user={item.user} size={36} />}
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm">
          {hideActor ? (
            actionLabelStandalone(item)
          ) : (
            <>
              <span className="font-medium">{item.user?.username ?? "Quelqu'un"}</span> {actionLabel(item)}
            </>
          )}
        </p>
        {item.text && <p className="mt-0.5 truncate text-xs text-ink-soft">« {item.text} »</p>}
        <p className="mt-1 text-[11px] text-ink-soft">{new Date(item.created_at).toLocaleDateString("fr-FR")}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-block border-2 border-ink bg-yellow px-2.5 py-1.5 text-xs font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
      >
        {label}
      </Link>
    </div>
  );
}
