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
    path("reviews/<int:review_id>/comments/", views.ReviewCommentsView.as_view(), name="review-comments"),
    path("comments/<int:comment_id>/replies/", views.CommentRepliesView.as_view(), name="comment-replies"),
    path("comments/<int:pk>/", views.CommentDetailView.as_view(), name="comment-detail"),
    path("comments/<int:comment_id>/photos/", views.CommentPhotosView.as_view(), name="comment-photos"),
    path("comment-photos/<int:pk>/", views.CommentPhotoDetailView.as_view(), name="comment-photo-detail"),
    path("reviews/<int:review_id>/react/", views.ReviewReactionView.as_view(), name="review-react"),
    path("comments/<int:comment_id>/react/", views.CommentReactionView.as_view(), name="comment-react"),
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/mark-read/", views.NotificationMarkReadView.as_view(), name="notification-mark-read"),
    path(
        "notifications/unread-count/",
        views.NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),
    path("activity/", views.ActivityFeedView.as_view(), name="activity-feed"),
    path("users/<int:pk>/profile/", views.UserProfileView.as_view(), name="user-profile"),
    path("admin/users/", views.AdminUserListView.as_view(), name="admin-user-list"),
    path("admin/users/<int:pk>/", views.AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/invite-code/", views.InviteCodeView.as_view(), name="invite-code"),
    path(
        "admin/invite-code/regenerate/",
        views.InviteCodeRegenerateView.as_view(),
        name="invite-code-regenerate",
    ),
]

urlpatterns += router.urls
