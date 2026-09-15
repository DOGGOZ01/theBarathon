from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from . import reactions, top_votes
from .models import REACTION_EMOJIS, City, Comment, CommentPhoto, InviteConfig, Notification, Place, Review, ReviewPhoto

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(source="is_superuser", read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "is_admin", "avatar")


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("avatar",)


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=25)
    password = serializers.CharField(write_only=True)
    invite_code = serializers.CharField(write_only=True)
    avatar = serializers.ImageField(required=False, allow_null=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_invite_code(self, value):
        invite = InviteConfig.get_solo()
        if value != invite.code:
            raise serializers.ValidationError("Code d'invitation invalide.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            avatar=validated_data.get("avatar"),
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = (
            "id",
            "name",
            "country",
            "photo",
            "latitude",
            "longitude",
            "is_default",
            "order",
            "created_at",
        )
        read_only_fields = ("id", "order", "created_at")


class CityReorderSerializer(serializers.Serializer):
    order = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class ReactionInputSerializer(serializers.Serializer):
    emoji = serializers.ChoiceField(choices=REACTION_EMOJIS)


class PlaceTopFieldsMixin:
    """Adds top_count + my_top_next_available_at to a Place serializer."""

    def get_top_count(self, obj):
        return obj.top_votes.count()

    def get_my_top_next_available_at(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not (user and user.is_authenticated):
            return None
        return top_votes.next_available_at(obj, user)


class PlaceListSerializer(PlaceTopFieldsMixin, serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    top_count = serializers.SerializerMethodField()
    my_top_next_available_at = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = (
            "id",
            "city",
            "name",
            "place_type",
            "event_date",
            "photo",
            "latitude",
            "longitude",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
            "avg_spent",
            "top_count",
            "my_top_next_available_at",
            "created_by",
        )
        read_only_fields = (
            "id",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
            "avg_spent",
            "created_by",
        )

    def validate(self, attrs):
        place_type = attrs.get("place_type", self.instance.place_type if self.instance else None)
        if place_type == Place.TYPE_EVENEMENT:
            existing_date = self.instance.event_date if self.instance else None
            if attrs.get("event_date", existing_date) is None:
                raise serializers.ValidationError(
                    {"event_date": "La date est requise pour un événement."}
                )
        elif "event_date" in attrs:
            attrs["event_date"] = None
        return attrs


class ReviewPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewPhoto
        fields = ("id", "review", "image", "uploaded_at")
        read_only_fields = ("id", "review", "uploaded_at")


class ReactionFieldsMixin:
    """Adds reactions_summary + my_reaction to a Review/Comment serializer."""

    def _reaction_summary(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        if not (user and user.is_authenticated):
            return {"reactions_summary": [], "my_reaction": None}
        return reactions.format_summary(obj, user)

    def get_reactions_summary(self, obj):
        return self._reaction_summary(obj)["reactions_summary"]

    def get_my_reaction(self, obj):
        return self._reaction_summary(obj)["my_reaction"]


class CommentPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommentPhoto
        fields = ("id", "comment", "image", "uploaded_at")
        read_only_fields = ("id", "comment", "uploaded_at")


def build_comments_by_parent(review):
    """Fetch every comment on a review in one flat query and group by
    parent_id, so serializing the whole (arbitrarily deep) reply tree costs
    one query instead of one per node."""
    all_comments = list(
        review.comments.select_related("user").prefetch_related("photos", "reactions").order_by("created_at")
    )
    by_parent = {}
    for comment in all_comments:
        by_parent.setdefault(comment.parent_id, []).append(comment)
    return by_parent


class CommentSerializer(ReactionFieldsMixin, serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    photos = CommentPhotoSerializer(many=True, read_only=True)
    replies = serializers.SerializerMethodField()
    reactions_summary = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            "id",
            "review",
            "parent",
            "user",
            "text",
            "photos",
            "replies",
            "reactions_summary",
            "my_reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "review", "parent", "user", "created_at", "updated_at")

    def get_replies(self, obj):
        # When available (see build_comments_by_parent), this avoids one
        # query per node of the reply tree — the whole thread for a review
        # is fetched flat, once, up front. Fall back to a direct query for
        # standalone use (e.g. CommentDetailView), where that isn't set up.
        by_parent = self.context.get("comments_by_parent")
        if by_parent is not None:
            children = by_parent.get(obj.id, [])
        else:
            children = obj.replies.all().select_related("user").prefetch_related("photos", "reactions")
        return CommentSerializer(children, many=True, context=self.context).data


class ReviewSerializer(ReactionFieldsMixin, serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    photos = ReviewPhotoSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    reactions_summary = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    # All four rating fields are conditionally required depending on
    # place.place_type (see validate()), so none of them are required at
    # the field level — Place.TYPE_BALADE only fills rating_overall, every
    # other type only fills atmosphere/drinks/price.
    rating_atmosphere = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)
    rating_drinks = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)
    rating_price = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)
    rating_overall = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)

    class Meta:
        model = Review
        fields = (
            "id",
            "place",
            "user",
            "rating_atmosphere",
            "rating_drinks",
            "rating_price",
            "rating_overall",
            "amount_spent",
            "text",
            "photos",
            "comments",
            "reactions_summary",
            "my_reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "place", "user", "created_at", "updated_at")

    def validate(self, attrs):
        place = self.instance.place if self.instance else self.context.get("place")
        if place is not None:
            def final(field):
                existing = getattr(self.instance, field) if self.instance else None
                return attrs.get(field, existing)

            if place.place_type not in Place.TYPES_WITH_CRITERIA:
                if final("rating_overall") is None:
                    raise serializers.ValidationError(
                        {"rating_overall": "La note globale est requise pour ce type d'établissement."}
                    )
                attrs["rating_atmosphere"] = None
                attrs["rating_drinks"] = None
                attrs["rating_price"] = None
            else:
                if final("rating_atmosphere") is None:
                    raise serializers.ValidationError(
                        {"rating_atmosphere": "La note ambiance est requise pour ce type d'établissement."}
                    )
                if final("rating_price") is None:
                    raise serializers.ValidationError(
                        {"rating_price": "La note rapport qualité-prix est requise pour ce type d'établissement."}
                    )
                requires_drinks = place.place_type in Place.TYPES_WITH_DRINKS
                if requires_drinks and final("rating_drinks") is None:
                    raise serializers.ValidationError(
                        {"rating_drinks": "La note boissons est requise pour ce type d'établissement."}
                    )
                if not requires_drinks:
                    attrs["rating_drinks"] = None
                attrs["rating_overall"] = None
        return attrs

    def get_comments(self, obj):
        by_parent = build_comments_by_parent(obj)
        top_level = by_parent.get(None, [])
        context = {**self.context, "comments_by_parent": by_parent}
        return CommentSerializer(top_level, many=True, context=context).data


class PlaceDetailSerializer(PlaceTopFieldsMixin, serializers.ModelSerializer):
    reviews = ReviewSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    top_count = serializers.SerializerMethodField()
    my_top_next_available_at = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = (
            "id",
            "city",
            "name",
            "place_type",
            "event_date",
            "photo",
            "latitude",
            "longitude",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
            "avg_spent",
            "top_count",
            "my_top_next_available_at",
            "created_at",
            "created_by",
            "reviews",
        )
        read_only_fields = (
            "id",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
            "avg_spent",
            "created_at",
            "created_by",
        )


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    place_id = serializers.IntegerField(source="review.place_id", read_only=True)
    place_name = serializers.CharField(source="review.place.name", read_only=True)
    city_id = serializers.IntegerField(source="review.place.city_id", read_only=True)
    preview_text = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "actor",
            "verb",
            "review",
            "comment",
            "reaction_emoji",
            "is_read",
            "created_at",
            "place_id",
            "place_name",
            "city_id",
            "preview_text",
        )
        read_only_fields = fields

    def get_preview_text(self, obj):
        source = obj.comment if obj.comment_id else obj.review
        return (source.text or "")[:140]


class InviteConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = InviteConfig
        fields = ("code", "updated_at")
