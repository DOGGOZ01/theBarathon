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

from .models import City, InviteConfig, Place, Review, ReviewPhoto
from .permissions import IsAdmin, IsAdminOrCreateByAnyAuthenticated, IsAdminOrReadOnly, IsOwnerOrAdmin
from .serializers import (
    CityReorderSerializer,
    CitySerializer,
    InviteConfigSerializer,
    LoginSerializer,
    PlaceDetailSerializer,
    PlaceListSerializer,
    RegisterSerializer,
    ReviewPhotoSerializer,
    ReviewSerializer,
    UserSerializer,
)

User = get_user_model()

MAX_REVIEW_PHOTOS = 5


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
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
        response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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


class PlaceViewSet(viewsets.ModelViewSet):
    queryset = Place.objects.select_related("city").all()
    permission_classes = [IsAdminOrCreateByAnyAuthenticated]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlaceDetailSerializer
        return PlaceListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CityPlacesView(generics.ListCreateAPIView):
    serializer_class = PlaceListSerializer
    permission_classes = [IsAdminOrCreateByAnyAuthenticated]

    def get_queryset(self):
        return Place.objects.filter(city_id=self.kwargs["city_id"])

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
        place = get_object_or_404(Place, pk=self.kwargs["place_id"])
        if Review.objects.filter(place=place, user=request.user).exists():
            return Response(
                {"detail": "Vous avez déjà laissé un avis pour cet établissement."}, status=status.HTTP_409_CONFLICT
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(place=place, user=request.user)
        except IntegrityError:
            # Belt-and-braces for the race where two concurrent requests both
            # pass the exists() check above before either has saved; the
            # place+user unique_together constraint is the real backstop.
            return Response(
                {"detail": "Vous avez déjà laissé un avis pour cet établissement."}, status=status.HTTP_409_CONFLICT
            )
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
