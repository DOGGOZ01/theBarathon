from django.contrib.contenttypes.models import ContentType

from .models import REACTION_EMOJIS, Notification, Reaction


def summarize(target, current_user):
    """Return ({emoji: count}, my_emoji) for a Review or Comment instance."""
    counts = {}
    my_emoji = None
    for reaction in target.reactions.all():
        counts[reaction.emoji] = counts.get(reaction.emoji, 0) + 1
        if reaction.user_id == current_user.id:
            my_emoji = reaction.emoji
    return counts, my_emoji


def _target_owner(target):
    return target.user


def _reaction_target_parts(target):
    from .models import Comment, Review

    review = target if isinstance(target, Review) else target.review
    comment = target if isinstance(target, Comment) else None
    return review, comment


def _notify_reaction(actor, target, emoji):
    recipient = _target_owner(target)
    if recipient.id == actor.id:
        return
    review, comment = _reaction_target_parts(target)
    notif, created = Notification.objects.get_or_create(
        recipient=recipient,
        actor=actor,
        verb=Notification.VERB_REACTION,
        review=review,
        comment=comment,
        defaults={"reaction_emoji": emoji},
    )
    if not created:
        notif.reaction_emoji = emoji
        notif.is_read = False
        notif.save(update_fields=["reaction_emoji", "is_read"])


def _clear_reaction_notification(actor, target):
    recipient = _target_owner(target)
    review, comment = _reaction_target_parts(target)
    Notification.objects.filter(
        recipient=recipient, actor=actor, verb=Notification.VERB_REACTION, review=review, comment=comment
    ).delete()


def format_summary(target, user):
    counts, mine = summarize(target, user)
    return {
        "reactions_summary": [{"emoji": e, "count": c} for e, c in sorted(counts.items(), key=lambda kv: -kv[1])],
        "my_reaction": mine,
    }


def notify_reply(comment):
    """Notify whoever owns the review/comment that `comment` replied to."""
    parent_owner = comment.parent.user if comment.parent_id else comment.review.user
    if parent_owner.id == comment.user_id:
        return
    Notification.objects.create(
        recipient=parent_owner,
        actor=comment.user,
        verb=Notification.VERB_REPLY,
        review=comment.review,
        comment=comment,
    )


def notify_place_activity(actor, place, review, comment=None):
    """Notify the place's creator about a new review or comment on it."""
    owner = place.created_by
    if owner is None or owner.id == actor.id:
        return
    Notification.objects.create(
        recipient=owner,
        actor=actor,
        verb=Notification.VERB_PLACE_ACTIVITY,
        review=review,
        comment=comment,
    )


def toggle(user, target, emoji):
    """Create/replace/remove `user`'s reaction on `target`. Returns the new summary."""
    if emoji not in REACTION_EMOJIS:
        raise ValueError("Emoji de réaction invalide.")

    content_type = ContentType.objects.get_for_model(target)
    existing = Reaction.objects.filter(content_type=content_type, object_id=target.pk, user=user).first()

    if existing and existing.emoji == emoji:
        existing.delete()
        _clear_reaction_notification(user, target)
    elif existing:
        existing.emoji = emoji
        existing.save(update_fields=["emoji"])
        _notify_reaction(user, target, emoji)
    else:
        Reaction.objects.create(content_type=content_type, object_id=target.pk, user=user, emoji=emoji)
        _notify_reaction(user, target, emoji)

    return summarize(target, user)


def toggle_and_format(user, target, emoji):
    toggle(user, target, emoji)
    return format_summary(target, user)
