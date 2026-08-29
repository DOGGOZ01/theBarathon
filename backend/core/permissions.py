from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminOrReadOnly(BasePermission):
    """Anyone authenticated can read; only admins (is_superuser) can write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsAdminOrCreateByAnyAuthenticated(BasePermission):
    """Read for any authenticated user, create for any authenticated user.
    PATCH (rename/re-photo only, enforced in the view) is allowed for the
    place's own creator or an admin; PUT/DELETE stay admin-only."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS or request.method in ("POST", "PATCH"):
            return True
        return bool(request.user.is_superuser)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user and request.user.is_superuser:
            return True
        if request.method == "PATCH":
            return obj.created_by_id == request.user.id
        return False


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsOwnerOrAdmin(BasePermission):
    """Object-level: owner of the resource (via `user` attr) or admin."""

    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_superuser:
            return True
        owner = getattr(obj, "user", None)
        return owner is not None and owner == request.user
