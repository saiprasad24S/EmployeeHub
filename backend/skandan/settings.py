import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


_load_env_file(BASE_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int = 0) -> int:
    value = os.getenv(name)
    return int(value) if value is not None and value != "" else default


def _database_config(url: str) -> dict:
    if not url or url.startswith("sqlite:///"):
        sqlite_path = BASE_DIR / "db.sqlite3"
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(sqlite_path),
        }
    parsed = urlparse(url)
    if parsed.scheme != "mysql":
        raise ValueError("DATABASE_URL must use mysql://")
    return {
        "ENGINE": "django.db.backends.mysql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username or "",
        "PASSWORD": parsed.password or "",
        "HOST": parsed.hostname or "localhost",
        "PORT": parsed.port or 3306,
        "OPTIONS": {"charset": "utf8mb4"},
    }


SECRET_KEY = _env("SECRET_KEY", default="replace-me")
DEBUG = _env_bool("DEBUG", default=False)
ALLOWED_HOSTS = [host.strip() for host in _env("ALLOWED_HOSTS", default="*").split(",") if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "cloudinary",
    "cloudinary_storage",
    "apps.accounts",
    "apps.assignments",
    "apps.attendance",
    "apps.tracking",
    "apps.vision",
    "apps.analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "skandan.urls"
WSGI_APPLICATION = "skandan.wsgi.application"
ASGI_APPLICATION = "skandan.asgi.application"

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
    }
]

DATABASES = {"default": _database_config(_env("DATABASE_URL", default=""))}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(_env("MEDIA_ROOT", default=str(BASE_DIR / "media")))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _env("CORS_ALLOWED_ORIGINS", default="").split(",") if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.ClerkJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": _env("CLOUDINARY_CLOUD_NAME", default=""),
    "API_KEY": _env("CLOUDINARY_API_KEY", default=""),
    "API_SECRET": _env("CLOUDINARY_API_SECRET", default=""),
}

# Fall back to local file storage if Cloudinary config is missing or invalid
if (
    not CLOUDINARY_STORAGE["CLOUD_NAME"]
    or not CLOUDINARY_STORAGE["API_KEY"]
    or not CLOUDINARY_STORAGE["API_SECRET"]
    or "noapeFhi" in CLOUDINARY_STORAGE["CLOUD_NAME"]
):
    DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
else:
    DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"

CLERK_SECRET_KEY = _env("CLERK_SECRET_KEY", default="")
CLERK_JWKS_URL = _env("CLERK_JWKS_URL", default="")
CLERK_ISSUER = _env("CLERK_ISSUER", default="")
CLERK_AUDIENCE = _env("CLERK_AUDIENCE", default="skandan-backend")
DEFAULT_GEOFENCE_RADIUS_METERS = _env_int("DEFAULT_GEOFENCE_RADIUS_METERS", default=100)

CELERY_BROKER_URL = _env("REDIS_URL", default="redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{asctime} {levelname} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
