import secrets

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import AbstractUser, UserManager
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

RATING_VALIDATORS = [MinValueValidator(1), MaxValueValidator(5)]

REACTION_EMOJIS = ("like", "love", "haha", "wow", "sad", "angry")
REACTION_CHOICES = [
    ("like", "👍"),
    ("love", "❤️"),
    ("haha", "😂"),
    ("wow", "😮"),
    ("sad", "😢"),
    ("angry", "😡"),
]


class NoEmailUserManager(UserManager):
    def _create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError("The given username must be set")
        user = self.model(username=username, **extra_fields)
        user.password = make_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(username, password, **extra_fields)


class User(AbstractUser):
    """Login-only auth, no email. is_superuser doubles as is_admin."""

    email = None
    REQUIRED_FIELDS = []
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    objects = NoEmailUserManager()

    @property
    def is_admin(self):
        return self.is_superuser


class InviteConfig(models.Model):
    """Singleton holding the single shared invite code."""

    code = models.CharField(max_length=32, unique=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={"code": cls.generate_code()})
        return obj

    @staticmethod
    def generate_code():
        return secrets.token_urlsafe(9)

    def regenerate(self):
        self.code = self.generate_code()
        self.save(update_fields=["code", "updated_at"])
        return self.code

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    def __str__(self):
        return f"InviteConfig({self.code})"


class City(models.Model):
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=120)
    photo = models.ImageField(upload_to="cities/", blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cities_created"
    )
    is_default = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.name}, {self.country}"


class Place(models.Model):
    TYPE_BAR = "bar"
    TYPE_RESTAURANT = "restaurant"
    TYPE_ENDROIT = "endroit"
    TYPE_CHOICES = [
        (TYPE_BAR, "Bar"),
        (TYPE_RESTAURANT, "Restaurant"),
        (TYPE_ENDROIT, "Endroit"),
    ]
    # Bar and restaurant collect the same 3 criteria (atmosphere/drinks/price);
    # "endroit" is a lighter-weight spot with no drinks rating at all.
    TYPES_WITH_DRINKS = (TYPE_BAR, TYPE_RESTAURANT)

    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="places")
    name = models.CharField(max_length=50)
    place_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_BAR)
    photo = models.ImageField(upload_to="places/", blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="places_created"
    )
    avg_atmosphere = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_drinks = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_price = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_overall = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    avg_spent = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._loaded_place_type = self.place_type

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # place_type drives which criteria count toward avg_overall
        # (recalculate_ratings), so a type change must trigger a recompute —
        # otherwise the averages shown keep reflecting the old type until
        # the next unrelated review event happens to save() this place again.
        type_changed = self.pk is not None and self._loaded_place_type != self.place_type
        super().save(*args, **kwargs)
        self._loaded_place_type = self.place_type
        if type_changed:
            self.recalculate_ratings()

    def recalculate_ratings(self):
        aggregates = self.reviews.aggregate(
            a=models.Avg("rating_atmosphere"),
            d=models.Avg("rating_drinks"),
            p=models.Avg("rating_price"),
            s=models.Avg("amount_spent"),
        )
        atmosphere = aggregates["a"] or 0
        drinks = aggregates["d"] or 0
        price = aggregates["p"] or 0
        spent = aggregates["s"] or 0
        has_reviews = self.reviews.exists()
        if not has_reviews:
            overall = 0
        elif self.place_type == self.TYPE_ENDROIT:
            overall = (atmosphere + price) / 2
        else:
            overall = (atmosphere + drinks + price) / 3

        self.avg_atmosphere = round(atmosphere, 2)
        self.avg_drinks = round(drinks, 2)
        self.avg_price = round(price, 2)
        self.avg_overall = round(overall, 2)
        self.avg_spent = round(spent, 2)
        self.save(update_fields=["avg_atmosphere", "avg_drinks", "avg_price", "avg_overall", "avg_spent"])


class Review(models.Model):
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    rating_atmosphere = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    # Null for reviews of a Place.TYPE_ENDROIT place (no drinks criterion there).
    rating_drinks = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS, null=True, blank=True)
    rating_price = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    amount_spent = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    text = models.TextField(max_length=2000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reactions = GenericRelation("Reaction", related_query_name="review")

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("place", "user")

    def __str__(self):
        return f"{self.user} -> {self.place} ({self.rating_atmosphere}/{self.rating_drinks}/{self.rating_price})"


class ReviewPhoto(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="reviews/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo({self.pk}) for review {self.review_id}"


class Comment(models.Model):
    """A reply, threaded to any depth: either directly under a Review
    (parent is null) or under another Comment (parent set)."""

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments")
    text = models.TextField(max_length=2000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reactions = GenericRelation("Reaction", related_query_name="comment")

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment({self.pk}) by {self.user} on review {self.review_id}"


class CommentPhoto(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="comments/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo({self.pk}) for comment {self.comment_id}"


class Reaction(models.Model):
    """A single emoji reaction by one user on a Review or a Comment.
    One reaction per (user, target); switching the emoji updates it in
    place rather than stacking a second row."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reactions")
    emoji = models.CharField(max_length=10, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("content_type", "object_id", "user")

    def __str__(self):
        return f"{self.user} reacted {self.emoji} on {self.content_type}#{self.object_id}"


class Notification(models.Model):
    VERB_REPLY = "reply"
    VERB_REACTION = "reaction"
    # Fires on the owner of a Place when someone else adds a review or a
    # comment anywhere in that place's discussion — distinct from VERB_REPLY
    # (owner of the specific review/comment) since the place owner may be a
    # different person entirely.
    VERB_PLACE_ACTIVITY = "place_activity"
    VERB_CHOICES = [
        (VERB_REPLY, "reply"),
        (VERB_REACTION, "reaction"),
        (VERB_PLACE_ACTIVITY, "place_activity"),
    ]

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    verb = models.CharField(max_length=20, choices=VERB_CHOICES)
    # Always set: the review whose thread this event happened in, so the
    # notification can always navigate to a place even if `comment` (below)
    # is later deleted.
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="+")
    # Set when the event concerns a Comment: the new reply itself (verb=reply)
    # or the comment that got reacted to (verb=reaction, if not the review).
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    reaction_emoji = models.CharField(max_length=10, blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification({self.verb}) to {self.recipient} from {self.actor}"
