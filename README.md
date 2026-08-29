# theBarathon

Закрытое (invite-only) мини-приложение для оценки баров/заведений. Django +
DRF backend, Next.js mobile-first frontend, карта на MapLibre + самохостинге
тайлов Protomaps (Франция, без сторонних API/лимитов).

- [`backend/README.md`](backend/README.md) — API, создание админа, инвайт-код
- [`frontend/README.md`](frontend/README.md) — запуск клиента, дизайн-система, генерация файла карты (обязательно перед первым запуском — см. раздел "Map tiles")

## Быстрый старт (два терминала)

```bash
# 1) backend
cd backend
python -m venv venv && source venv/Scripts/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver localhost:8000

# 2) frontend
cd frontend
npm install
npm run dev
```

Открыть `http://localhost:3000`. Инвайт-код для регистрации создаётся
автоматически при первом обращении к `/api/admin/invite-code/` (зайти как
админ на `/admin` в приложении, там же кнопка регенерации).

## Тест с телефона / другого устройства в той же Wi-Fi сети

Фронтенд сам определяет адрес бэкенда по тому хосту, с которого открыта
страница (тот же хост, порт 8000) — ничего вручную настраивать не нужно.
Единственное, что важно: **бэкенд должен слушать не только localhost**,
иначе с телефона до него просто не достучаться:

```bash
python manage.py runserver 0.0.0.0:8000
```

`npm run dev` уже слушает `0.0.0.0` по умолчанию и печатает в терминале
адрес вида `http://192.168.x.x:3000` — его и открывать на телефоне. В
DEBUG-режиме (по умолчанию) бэкенд уже настроен принимать запросы с любого
хоста и с любого адреса из локальной сети (`ALLOWED_HOSTS`, CORS) — для
продакшена (`DJANGO_DEBUG=False`) это нужно будет задать явно через
`DJANGO_ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS`.
