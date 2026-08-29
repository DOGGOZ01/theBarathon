from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    City,
    Comment,
    CommentPhoto,
    InviteConfig,
    Notification,
    Place,
    Reaction,
    Review,
    ReviewPhoto,
    User,
)


class UserAdmin(DjangoUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("username", "password1", "password2", "is_superuser")}),
    )
    list_display = ("username", "is_superuser", "is_active")


admin.site.register(User, UserAdmin)
admin.site.register(City)
admin.site.register(Place)
admin.site.register(Review)
admin.site.register(ReviewPhoto)
admin.site.register(Comment)
admin.site.register(CommentPhoto)
admin.site.register(Reaction)
admin.site.register(Notification)
admin.site.register(InviteConfig)
