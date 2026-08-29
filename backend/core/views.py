from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from . import reactions
from .models import City, Comment, CommentPhoto, InviteConfig, Notification, Place, Review, ReviewPhoto
from .permissions import IsAdmin, IsAdminOrCreateByAnyAuthenticated, IsAdminOrReadOnly, IsOwnerOrAdmin
from .serializers import (
    CityReorderSerializer,
    CitySerializer,
    CommentPhotoSerializer,
    CommentSerializer,
    InviteConfigSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    NotificationSerializer,
    PlaceDetailSerializer,
    PlaceListSerializer,
    ReactionInputSerializer,
    RegisterSerializer,
    ReviewPhotoSerializer,
    ReviewSerializer,
    UserSerializer,
)

User = get_user_model()

MAX_REVIEW_PHOTOS = 5
MAX_COMMENT_PHOTOS = 3
ACTIVITY_FEED_LIMIT = 40


def _cookie_kwargs():
    return dict(
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )


def _set_auth_cookies(response, user):
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        str(access),
        max_age=int(access.lifetime.total_seconds()),
        **_cookie_kwargs(),
    )
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        str(refresh),
        max_age=int(refresh.lifetime.total_seconds()),
        **_cookie_kwargs(),
    )


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        _set_auth_cookies(response, user)
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = User.objects.filter(username__iexact=username).first()
        if user is None or not user.check_password(password) or not user.is_active:
            raise ValidationError({"detail": "Identifiants invalides."})

        response = Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        _set_auth_cookies(response, user)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw_refresh:
            return Response({"detail": "Aucun jeton de rafraîchissement."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(raw_refresh)
            access = refresh.access_token
        except TokenError:
            return Response({"detail": "Jeton de rafraîchissement invalide."}, status=status.HTTP_401_UNAUTHORIZED)

        response = Response(status=status.HTTP_200_OK)
        response.set_cookie(
            settings.AUTH_COOKIE_ACCESS,
            str(access),
            max_age=int(access.lifetime.total_seconds()),
            **_cookie_kwargs(),
        )
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                # Already invalid/expired/blacklisted — nothing more to revoke.
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
        response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class CityViewSet(viewsets.ModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [IsAdminOrReadOnly]

    def perform_create(self, serializer):
        next_order = (City.objects.aggregate(m=Max("order"))["m"] or 0) + 1
        serializer.save(created_by=self.request.user, order=next_order)

    def get_serializer_context(self):
        return {"request": self.request}

    @action(detail=False, methods=["post"], permission_classes=[IsAdmin])
    def reorder(self, request):
        serializer = CityReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        city_ids = serializer.validated_data["order"]

        cities = {c.id: c for c in City.objects.filter(pk__in=city_ids)}
        if len(cities) != len(set(city_ids)):
            raise ValidationError({"order": "Contains unknown city id(s)."})

        with transaction.atomic():
            for index, city_id in enumerate(city_ids):
                City.objects.filter(pk=city_id).update(order=index)

        return Response(CitySerializer(City.objects.filter(pk__in=city_ids), many=True).data)


PLACE_NON_ADMIN_EDITABLE_FIELDS = {"name", "photo"}


class PlaceViewSet(viewsets.ModelViewSet):
    queryset = Place.objects.select_related("city", "created_by").all()
    permission_classes = [IsAdminOrCreateByAnyAuthenticated]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlaceDetailSerializer
        return PlaceListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if not self.request.user.is_superuser:
            disallowed = set(serializer.validated_data) - PLACE_NON_ADMIN_EDITABLE_FIELDS
            if disallowed:
                raise PermissionDenied("Vous ne pouvez modifier que le nom et la photo de cet établissement.")
        serializer.save()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        places = self.get_queryset().filter(created_by=request.user)
        return Response(PlaceListSerializer(places, many=True, context=self.get_serializer_context()).data)


class CityPlacesView(generics.ListCreateAPIView):
    serializer_class = PlaceListSerializer
    permission_classes = [IsAdminOrCreateByAnyAuthenticated]

    def get_queryset(self):
        return Place.objects.select_related("created_by").filter(city_id=self.kwargs["city_id"])

    def perform_create(self, serializer):
        city = get_object_or_404(City, pk=self.kwargs["city_id"])
        serializer.save(city=city, created_by=self.request.user)


class PlaceReviewsView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(place_id=self.kwargs["place_id"]).select_related("user").prefetch_related(
            "photos"
        )

    def create(self, request, *args, **kwargs):
        place = get_object_or_404(Place.objects.select_related("created_by"), pk=self.kwargs["place_id"])
        if Review.objects.filter(place=place, user=request.user).exists():
            return Response(
                {"detail": "Vous avez déjà laissé un avis pour cet établissement."}, status=status.HTTP_409_CONFLICT
            )
        serializer = self.get_serializer(data=request.data, context={**self.get_serializer_context(), "place": place})
        serializer.is_valid(raise_exception=True)
        try:
            review = serializer.save(place=place, user=request.user)
        except IntegrityError:
            # Belt-and-braces for the race where two concurrent requests both
            # pass the exists() check above before either has saved; the
            # place+user unique_together constraint is the real backstop.
            return Response(
                {"detail": "Vous avez déjà laissé un avis pour cet établissement."}, status=status.HTTP_409_CONFLICT
            )
        reactions.notify_place_activity(request.user, place, review)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related("user", "place").prefetch_related("photos")
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    http_method_names = ["get", "patch", "delete", "head", "options"]


class ReviewPhotosView(generics.ListCreateAPIView):
    serializer_class = ReviewPhotoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReviewPhoto.objects.filter(review_id=self.kwargs["review_id"])

    def perform_create(self, serializer):
        review = get_object_or_404(Review, pk=self.kwargs["review_id"])
        if review.user_id != self.request.user.id and not self.request.user.is_superuser:
            raise PermissionDenied("Ce n'est pas votre avis.")
        if review.photos.count() >= MAX_REVIEW_PHOTOS:
            raise ValidationError({"detail": f"Maximum {MAX_REVIEW_PHOTOS} photos par avis."})
        serializer.save(review=review)


class ReviewPhotoDetailView(generics.DestroyAPIView):
    queryset = ReviewPhoto.objects.all()
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if obj.review.user_id != request.user.id and not request.user.is_superuser:
            raise PermissionDenied("Ce n'est pas votre photo.")


class ReviewCommentsView(generics.ListCreateAPIView):
    """Top-level replies to a review; each item's `replies` field carries the
    full nested thread beneath it, so the frontend gets the whole tree in one
    request."""

    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {"request": self.request}

    def get_queryset(self):
        return (
            Comment.objects.filter(review_id=self.kwargs["review_id"], parent__isnull=True)
            .select_related("user")
            .prefetch_related("photos", "reactions", "replies")
        )

    def perform_create(self, serializer):
        review = get_object_or_404(
            Review.objects.select_related("place", "place__created_by"), pk=self.kwargs["review_id"]
        )
        comment = serializer.save(review=review, parent=None, user=self.request.user)
        reactions.notify_reply(comment)
        reactions.notify_place_activity(self.request.user, review.place, review, comment)


class CommentRepliesView(generics.CreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        parent = get_object_or_404(
            Comment.objects.select_related("review", "review__place", "review__place__created_by"),
            pk=self.kwargs["comment_id"],
        )
        comment = serializer.save(review=parent.review, parent=parent, user=self.request.user)
        reactions.notify_reply(comment)
        reactions.notify_place_activity(self.request.user, parent.review.place, parent.review, comment)


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Comment.objects.all().select_related("user", "review").prefetch_related(
        "photos", "reactions", "replies"
    )
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_serializer_context(self):
        return {"request": self.request}


class CommentPhotosView(generics.ListCreateAPIView):
    serializer_class = CommentPhotoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CommentPhoto.objects.filter(comment_id=self.kwargs["comment_id"])

    def perform_create(self, serializer):
        comment = get_object_or_404(Comment, pk=self.kwargs["comment_id"])
        if comment.user_id != self.request.user.id and not self.request.user.is_superuser:
            raise PermissionDenied("Ce n'est pas votre commentaire.")
        if comment.photos.count() >= MAX_COMMENT_PHOTOS:
            raise ValidationError({"detail": f"Maximum {MAX_COMMENT_PHOTOS} photos par commentaire."})
        serializer.save(comment=comment)


class CommentPhotoDetailView(generics.DestroyAPIView):
    queryset = CommentPhoto.objects.all()
    permission_classes = [IsAuthenticated]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if obj.comment.user_id != request.user.id and not request.user.is_superuser:
            raise PermissionDenied("Ce n'est pas votre photo.")


class ReviewReactionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(Review, pk=review_id)
        serializer = ReactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(reactions.toggle_and_format(request.user, review, serializer.validated_data["emoji"]))


class CommentReactionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, comment_id):
        comment = get_object_or_404(Comment, pk=comment_id)
        serializer = ReactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(reactions.toggle_and_format(request.user, comment, serializer.validated_data["emoji"]))


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related(
            "actor", "review", "review__place", "comment"
        )[:50]


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get("ids")
        qs = Notification.objects.filter(recipient=request.user, is_read=False)
        if ids:
            qs = qs.filter(pk__in=ids)
        qs.update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"count": count})


def _place_activity_item(place):
    return {
        "type": "place",
        "id": place.id,
        "created_at": place.created_at,
        "user": UserSerializer(place.created_by).data if place.created_by else None,
        "place_id": place.id,
        "place_name": place.name,
        "city_id": place.city_id,
        "text": "",
    }


def _review_activity_item(review):
    return {
        "type": "review",
        "id": review.id,
        "created_at": review.created_at,
        "user": UserSerializer(review.user).data,
        "place_id": review.place_id,
        "place_name": review.place.name,
        "city_id": review.place.city_id,
        "text": review.text[:140],
    }


def _comment_activity_item(comment):
    return {
        "type": "comment",
        "id": comment.id,
        "created_at": comment.created_at,
        "user": UserSerializer(comment.user).data,
        "place_id": comment.review.place_id,
        "place_name": comment.review.place.name,
        "city_id": comment.review.place.city_id,
        "text": comment.text[:140],
    }


class ActivityFeedView(APIView):
    """Recently added places (anyone) and recently added reviews/comments
    (other users only), merged into one reverse-chronological feed."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = []

        places = Place.objects.select_related("city", "created_by").order_by("-created_at")[:ACTIVITY_FEED_LIMIT]
        items.extend(_place_activity_item(p) for p in places)

        reviews = (
            Review.objects.exclude(user=request.user)
            .select_related("user", "place", "place__city")
            .order_by("-created_at")[:ACTIVITY_FEED_LIMIT]
        )
        items.extend(_review_activity_item(r) for r in reviews)

        comments = (
            Comment.objects.exclude(user=request.user)
            .select_related("user", "review", "review__place", "review__place__city")
            .order_by("-created_at")[:ACTIVITY_FEED_LIMIT]
        )
        items.extend(_comment_activity_item(c) for c in comments)

        items.sort(key=lambda i: i["created_at"], reverse=True)
        return Response(items[:ACTIVITY_FEED_LIMIT])


class UserProfileView(APIView):
    """Public-within-the-group profile: what a user has added (places) and
    reviewed. Deliberately reviews only, not threaded comments — those are
    replies to other people's content and don't read as "this user's own
    stuff" the way a profile page should."""

    permission_classes = [IsAuthenticated]
    PROFILE_ACTIVITY_LIMIT = 100

    def get(self, request, pk):
        profile_user = get_object_or_404(User, pk=pk)

        places = Place.objects.select_related("city", "created_by").filter(created_by=profile_user)

        reviews = (
            Review.objects.filter(user=profile_user)
            .select_related("user", "place", "place__city")
            .order_by("-created_at")[: self.PROFILE_ACTIVITY_LIMIT]
        )
        items = [_review_activity_item(r) for r in reviews]

        return Response(
            {
                "user": UserSerializer(profile_user).data,
                "places": PlaceListSerializer(places, many=True, context={"request": request}).data,
                "activity": items[: self.PROFILE_ACTIVITY_LIMIT],
            }
        )


class InviteCodeView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        invite = InviteConfig.get_solo()
        return Response(InviteConfigSerializer(invite).data)


class InviteCodeRegenerateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        invite = InviteConfig.get_solo()
        invite.regenerate()
        return Response(InviteConfigSerializer(invite).data)
