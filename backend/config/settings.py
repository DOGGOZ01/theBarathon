"""
Django settings for the Bar Rating App backend.
"""

import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me-in-production"
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"

# In DEBUG (the dev default), accept any Host header unless DJANGO_ALLOWED_HOSTS
# is set explicitly — this lets the same backend be reached from a LAN IP
# (e.g. testing from a phone on the same Wi-Fi) without extra config. Always
# set DJANGO_ALLOWED_HOSTS explicitly once DEBUG=False.
_allowed_hosts_env = os.environ.get("DJANGO_ALLOWED_HOSTS")
if _allowed_hosts_env:
    ALLOWED_HOSTS = [h for h in _allowed_hosts_env.split(",") if h]
elif DEBUG:
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.MaxBodySizeMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "core.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PARSER_CLASSES": (
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON", "60/min"),
        "user": os.environ.get("THROTTLE_USER", "300/min"),
        # Brute-force protection for passwords and the invite code.
        "login": os.environ.get("THROTTLE_LOGIN", "10/min"),
        "register": os.environ.get("THROTTLE_REGISTER", "10/hour"),
        "refresh": os.environ.get("THROTTLE_REFRESH", "30/min"),
    },
    # Number of reverse proxies in front of gunicorn (nginx = 1). Throttling
    # keys anonymous clients by IP; without this every request looks like it
    # comes from the proxy (127.0.0.1) and all visitors share one bucket.
    # Only set it when gunicorn is NOT reachable directly, otherwise clients
    # can spoof X-Forwarded-For.
    "NUM_PROXIES": int(os.environ["DRF_NUM_PROXIES"]) if os.environ.get("DRF_NUM_PROXIES") else None,
}

# Throttle counters live in the cache. A file cache is shared by all gunicorn
# workers on the host (LocMemCache would give each worker its own counters).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": os.environ.get("DJANGO_CACHE_DIR", os.path.join(tempfile.gettempdir(), "thebarathon-cache")),
    }
}
if "test" in sys.argv:
    # Fresh, per-run counters so repeated test runs don't trip the throttles.
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Hard cap on request bodies (uploads included), enforced by
# core.middleware.MaxBodySizeMiddleware. Also set nginx client_max_body_size.
MAX_REQUEST_BODY_SIZE = int(os.environ.get("MAX_REQUEST_BODY_MB", "15")) * 1024 * 1024
# Comment reply chains deeper than this are rejected (the thread serializer
# is recursive, so unbounded depth could crash the review page).
MAX_COMMENT_DEPTH = 20

# --- SimpleJWT ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- Auth cookies ---
AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"
AUTH_COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "False") == "True"
AUTH_COOKIE_SAMESITE = os.environ.get("AUTH_COOKIE_SAMESITE", "Lax")
# Django's own cookies (used by /admin/) follow the same rule.
SESSION_COOKIE_SECURE = AUTH_COOKIE_SECURE
CSRF_COOKIE_SECURE = AUTH_COOKIE_SECURE

# The built-in Django admin isn't used by the app (everything goes through
# the API and the app's own /admin page), so it's only mounted in DEBUG unless
# explicitly enabled.
DJANGO_ADMIN_ENABLED = os.environ.get("DJANGO_ADMIN_ENABLED", str(DEBUG)) == "True"

# --- CORS ---
CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o
]
CORS_ALLOW_CREDENTIALS = True

if DEBUG:
    # Also accept the frontend when it's opened from a private LAN address
    # (e.g. http://192.168.1.23:3000 when testing from a phone) — the exact
    # IP isn't known ahead of time, so match private ranges by regex instead
    # of requiring CORS_ALLOWED_ORIGINS to be updated per network. Dev-only.
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost:\d+$",
        r"^http://127\.0\.0\.1:\d+$",
        r"^http://192\.168\.\d{1,3}\.\d{1,3}:\d+$",
        r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$",
        r"^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$",
    ]

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
