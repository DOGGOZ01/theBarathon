from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import City, InviteConfig, Place, Review, ReviewPhoto

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(source="is_superuser", read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "is_admin")


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    invite_code = serializers.CharField(write_only=True)

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


class PlaceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = (
            "id",
            "city",
            "name",
            "photo",
            "latitude",
            "longitude",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
        )
        read_only_fields = ("id", "avg_atmosphere", "avg_drinks", "avg_price", "avg_overall")


class ReviewPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewPhoto
        fields = ("id", "review", "image", "uploaded_at")
        read_only_fields = ("id", "review", "uploaded_at")


class ReviewSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    photos = ReviewPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "place",
            "user",
            "rating_atmosphere",
            "rating_drinks",
            "rating_price",
            "text",
            "photos",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "place", "user", "created_at", "updated_at")


class PlaceDetailSerializer(serializers.ModelSerializer):
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Place
        fields = (
            "id",
            "city",
            "name",
            "photo",
            "latitude",
            "longitude",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
            "created_at",
            "reviews",
        )
        read_only_fields = (
            "id",
            "avg_atmosphere",
            "avg_drinks",
            "avg_price",
            "avg_overall",
            "created_at",
        )


class InviteConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = InviteConfig
        fields = ("code", "updated_at")
