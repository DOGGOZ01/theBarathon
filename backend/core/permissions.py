from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminOrReadOnly(BasePermission):
    """Anyone authenticated can read; only admins (is_superuser) can write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsAdminOrCreateByAnyAuthenticated(BasePermission):
    """Read for any authenticated user, create for any authenticated user,
    but edit/delete restricted to admins. Used for Place: anyone can add a
    bar to a city, but only an admin can change or remove one."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS or request.method == "POST":
            return True
        return bool(request.user.is_superuser)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_superuser)


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
