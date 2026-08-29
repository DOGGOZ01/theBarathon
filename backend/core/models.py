import secrets

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import AbstractUser, UserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

RATING_VALIDATORS = [MinValueValidator(1), MaxValueValidator(5)]


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
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="places")
    name = models.CharField(max_length=150)
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def recalculate_ratings(self):
        aggregates = self.reviews.aggregate(
            a=models.Avg("rating_atmosphere"),
            d=models.Avg("rating_drinks"),
            p=models.Avg("rating_price"),
        )
        atmosphere = aggregates["a"] or 0
        drinks = aggregates["d"] or 0
        price = aggregates["p"] or 0
        overall = (atmosphere + drinks + price) / 3 if self.reviews.exists() else 0

        self.avg_atmosphere = round(atmosphere, 2)
        self.avg_drinks = round(drinks, 2)
        self.avg_price = round(price, 2)
        self.avg_overall = round(overall, 2)
        self.save(update_fields=["avg_atmosphere", "avg_drinks", "avg_price", "avg_overall"])


class Review(models.Model):
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    rating_atmosphere = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    rating_drinks = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    rating_price = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
