# theBarathon — backend

Django + DRF API for the bar rating app. JWT auth (SimpleJWT) delivered via
httpOnly cookies (`access_token`, `refresh_token`), no public endpoints
except register/login/refresh.

## Setup

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # Windows Git Bash; use venv\Scripts\activate.bat on cmd
pip install -r requirements.txt
python manage.py migrate
```

## Creating the admin (the only way to become admin)

There is no "make me admin" flow in the app. `is_superuser` is used directly
as `is_admin` everywhere in the API.

```bash
python manage.py createsuperuser
```

## Invite code

On first request to `/api/admin/invite-code/`, a code is generated
automatically (singleton `InviteConfig`, pk=1). Admins can fetch/regenerate it
via:

```
GET  /api/admin/invite-code/
POST /api/admin/invite-code/regenerate/
```

New users register with `POST /api/auth/register/` using that code.

## Environment variables (all optional, sane dev defaults)

| Var                     | Default                  | Notes                                   |
|-------------------------|---------------------------|------------------------------------------|
| `DJANGO_SECRET_KEY`     | dev key                   | set a real one in production             |
| `DJANGO_DEBUG`          | `True`                    | set `False` in production                |
| `DJANGO_ALLOWED_HOSTS`  | `localhost,127.0.0.1`     | comma-separated                          |
| `CORS_ALLOWED_ORIGINS`  | `http://localhost:3000`   | comma-separated, must match frontend origin exactly |
| `AUTH_COOKIE_SECURE`    | `False`                   | set `True` when served over HTTPS        |
| `AUTH_COOKIE_SAMESITE`  | `Lax`                     |                                           |

## Run

```bash
python manage.py runserver 127.0.0.1:8000
```

## API contract summary

See project spec. All endpoints under `/api/` except `/api/auth/register/`,
`/api/auth/login/`, `/api/auth/refresh/` require authentication (cookie-based
JWT). Admin-only writes are enforced via `IsAdminOrReadOnly` /
`IsAdmin` permission classes in `core/permissions.py`.

Uploaded media (city/place photos, review photos) is served from `/media/`
in dev via Django; put a real file server / storage backend in front of it
in production.
