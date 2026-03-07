# IaaS Platform (Hackathon Prototype)

Упрощённая IaaS-платформа для хакатона. Django — управляющий слой (control plane), Proxmox — гипервизор (compute layer), React — клиентский портал.

## Архитектура

```
┌──────────────┐      REST API      ┌──────────────────┐      Proxmox API     ┌──────────────┐
│  React SPA   │ ─────────────────> │  Django Backend   │ ───────────────────> │  Proxmox VE  │
│  (Frontend)  │                    │  (Control Plane)  │                      │  (Compute)   │
└──────────────┘                    └──────────────────┘                      └──────────────┘
                                             │
                                     ┌───────┴───────┐
                                     │  PostgreSQL DB │
                                     └───────────────┘
```

## Требования

- **Docker Desktop** — [скачать](https://www.docker.com/products/docker-desktop/) (включает Docker и Docker Compose)
- **Git** — для клонирования репозитория

Без Docker (локальный запуск) дополнительно нужны:
- Python 3.10+
- Node.js 18+
- PostgreSQL 15 (или SQLite для простого варианта)

---

## Запуск с нуля (Docker — рекомендуемый способ)

### Шаг 1. Клонировать репозиторий

```bash
git clone <url-репозитория>
cd iaas-platform
```

### Шаг 2. Запустить все сервисы

```bash
docker-compose up --build -d
```

Эта команда:
- Скачает образы PostgreSQL 15, Python 3.11, Node.js 20
- Соберёт контейнеры бэкенда и фронтенда
- Запустит 3 контейнера: `db`, `backend`, `frontend`

Первый запуск может занять 2-5 минут (скачивание образов).

### Шаг 3. Применить миграции базы данных

```bash
docker-compose exec backend python manage.py migrate
```

### Шаг 4. Наполнить демо-данными

```bash
docker-compose exec backend python manage.py seed_demo
```

### Шаг 5. Открыть в браузере

```
http://localhost:5173
```

### Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Provider Admin (администратор платформы) | `admin@iaas.local` | `admin123` |
| Tenant Admin (администратор организации) | `aleksei@acme.com` | `user123` |
| Tenant User (пользователь организации) | `maria@acme.com` | `user123` |

---

## Управление контейнерами

```bash
# Посмотреть статус контейнеров
docker-compose ps

# Посмотреть логи в реальном времени
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f backend

# Остановить всё
docker-compose stop

# Запустить снова (без пересборки)
docker-compose start

# Остановить и удалить контейнеры (данные БД сохранятся в volume)
docker-compose down

# Полная очистка (включая данные БД)
docker-compose down -v
```

---

## Запуск без Docker (локально)

### Вариант A: с PostgreSQL через Docker (только БД в контейнере)

```bash
# 1. Запустить только PostgreSQL
docker-compose up -d db

# 2. Бэкенд (в терминале 1)
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # Windows
# source venv/bin/activate            # Linux/Mac
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver

# 3. Фронтенд (в терминале 2)
cd frontend
npm install
npm run dev
```

### Вариант B: полностью без Docker (SQLite)

В файле `backend/.env` измените:
```
USE_POSTGRES=False
```

Затем:
```bash
# 1. Бэкенд (в терминале 1)
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver

# 2. Фронтенд (в терминале 2)
cd frontend
npm install
npm run dev
```

---

## Порты

| Сервис | Порт | URL |
|--------|------|-----|
| Frontend (React) | 5173 | http://localhost:5173 |
| Backend (Django) | 8000 | http://localhost:8000 |
| Django Admin | 8000 | http://localhost:8000/admin/ |
| PostgreSQL | 5432 | — |

## Приложения Django

| Модуль | Описание |
|--------|----------|
| `iam` | Пользователи, роли, аутентификация (JWT) |
| `tenants` | Тенанты (организации), членство |
| `compute` | Виртуальные машины, ноды, flavors, шаблоны ОС |
| `quotas` | Управление квотами ресурсов |
| `audit` | Журнал аудита действий |
| `integrations/proxmox` | Реальный клиент Proxmox VE API |
| `integrations/mock` | Mock-адаптер (без реального Proxmox) |

## Proxmox

По умолчанию используется **Mock-адаптер** — симулирует создание/управление ВМ без реального Proxmox-сервера. Для подключения реального Proxmox заполните параметры `PROXMOX_*` в `backend/.env` и создайте запись `HypervisorAccount` с `kind=PROXMOX` в Django Admin.

## Структура проекта

```
iaas-platform/
├── backend/                  # Django REST API
│   ├── apps/
│   │   ├── iam/              # Пользователи и аутентификация
│   │   ├── tenants/          # Тенанты
│   │   ├── compute/          # ВМ, ноды, flavors
│   │   ├── quotas/           # Квоты
│   │   ├── audit/            # Аудит-лог
│   │   └── integrations/     # Proxmox / Mock адаптеры
│   ├── config/               # Настройки Django
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── api/              # Axios-клиенты для API
│   │   ├── context/          # AppContext (глобальное состояние)
│   │   ├── pages/            # Страницы приложения
│   │   ├── components/       # UI-компоненты
│   │   └── App.jsx           # Роутинг
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```
