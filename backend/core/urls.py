from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"cities", views.CityViewSet, basename="city")
router.register(r"places", views.PlaceViewSet, basename="place")
router.register(r"reviews", views.ReviewViewSet, basename="review")

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("cities/<int:city_id>/places/", views.CityPlacesView.as_view(), name="city-places"),
    path("places/<int:place_id>/reviews/", views.PlaceReviewsView.as_view(), name="place-reviews"),
    path("reviews/<int:review_id>/photos/", views.ReviewPhotosView.as_view(), name="review-photos"),
    path("photos/<int:pk>/", views.ReviewPhotoDetailView.as_view(), name="photo-detail"),
    path("admin/invite-code/", views.InviteCodeView.as_view(), name="invite-code"),
    path(
        "admin/invite-code/regenerate/",
        views.InviteCodeRegenerateView.as_view(),
        name="invite-code-regenerate",
    ),
]

urlpatterns += router.urls
