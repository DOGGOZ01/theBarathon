from datetime import timedelta

from django.utils import timezone

from .models import PlaceTopVote, Review

COOLDOWN = timedelta(hours=16)


class TopVoteError(Exception):
    """Raised by cast() when the vote is rejected; carries the HTTP status
    the view should respond with and, for a cooldown rejection, when the
    user can vote again."""

    def __init__(self, message, *, status_code, next_available_at=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.next_available_at = next_available_at


def next_available_at(place, user):
    """None if `user` can vote Top for `place` right now, otherwise the
    datetime their cooldown lifts."""
    last = PlaceTopVote.objects.filter(place=place, user=user).order_by("-created_at").first()
    if last is None:
        return None
    available = last.created_at + COOLDOWN
    return available if available > timezone.now() else None


def cast(place, user):
    """Record a Top vote for `place` by `user`. Returns the datetime the
    next vote becomes available. Raises TopVoteError if `user` hasn't
    reviewed `place` yet or is still on cooldown."""
    if not Review.objects.filter(place=place, user=user).exists():
        raise TopVoteError(
            "Vous devez laisser un avis avant de voter Top pour cet établissement.",
            status_code=403,
        )
    available_at = next_available_at(place, user)
    if available_at is not None:
        raise TopVoteError(
            "Vous avez déjà voté Top pour cet établissement aujourd'hui.",
            status_code=429,
            next_available_at=available_at,
        )
    vote = PlaceTopVote.objects.create(place=place, user=user)
    return vote.created_at + COOLDOWN
