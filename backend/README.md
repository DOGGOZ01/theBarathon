# theBarathon backend

Django + DRF API. Auth uses JWT (SimpleJWT) stored in httpOnly cookies
(`access_token`, `refresh_token`). Every endpoint except register, login and
refresh requires a logged-in user.

## Setup

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # Git Bash on Windows; on cmd use venv\Scripts\activate.bat
pip install -r requirements.txt
python manage.py migrate
```

## Creating an admin

The app has no way to promote a user. Admins are Django superusers
(`is_superuser` is exposed as `is_admin` in the API):

```bash
python manage.py createsuperuser
```

## Invite code

The code is created on the first request to `/api/admin/invite-code/`
(singleton `InviteConfig`, pk=1). Admins can read or regenerate it:

```
GET  /api/admin/invite-code/
POST /api/admin/invite-code/regenerate/
```

New users register with `POST /api/auth/register/` and that code.

## Environment variables

All optional. The defaults are meant for local development.

| Variable | Default | Notes |
|---|---|---|
| `DJANGO_SECRET_KEY` | dev key | Set a real one in production |
| `DJANGO_DEBUG` | `True` | `False` in production |
| `DJANGO_ALLOWED_HOSTS` | any host in DEBUG, else `localhost,127.0.0.1` | Comma-separated |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated, must match the frontend origin exactly |
| `AUTH_COOKIE_SECURE` | `False` | `True` when served over HTTPS |
| `AUTH_COOKIE_SAMESITE` | `Lax` | |
| `DRF_NUM_PROXIES` | not set | Number of proxies in front of gunicorn, so throttling sees the real client IP (Cloudflare + nginx = 2) |
| `THROTTLE_LOGIN` / `THROTTLE_REGISTER` / `THROTTLE_REFRESH` | `10/min` / `10/hour` / `30/min` | Rate limits for the auth endpoints |
| `THROTTLE_ANON` / `THROTTLE_USER` | `60/min` / `300/min` | General rate limits |
| `MAX_REQUEST_BODY_MB` | `15` | Larger requests get a 413 |
| `DJANGO_CACHE_DIR` | system temp dir | File cache for the throttle counters (production only; DEBUG uses memory) |
| `DJANGO_ADMIN_ENABLED` | same as `DJANGO_DEBUG` | Mounts the Django admin at `/admin/` |

## Run

```bash
python manage.py runserver localhost:8000
```

## Tests

```bash
python manage.py test core
```

## API

Routes are listed in `core/urls.py`. Permission classes live in
`core/permissions.py`.

Uploaded media (city, place, review and comment photos) is served from
`/media/` by Django in DEBUG only. In production the web server (nginx)
serves it.
