import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import logging

logger = logging.getLogger(__name__)

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


def _is_placeholder(value: str) -> bool:
    return not value or value.strip().lower() in {"replace-me", "replace-with-aiven-password", "your-aiven-host.aivencloud.com", "changeme"}


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

    query = parse_qs(parsed.query)
    options = {"charset": "utf8mb4"}
    ssl_mode = query.get("ssl-mode", [None])[0]
    ssl_ca = query.get("ssl-ca", [None])[0]
    if ssl_mode:
        options["ssl"] = {"ssl-mode": ssl_mode}
        if ssl_ca:
            options["ssl"]["ca"] = ssl_ca

    return {
        "ENGINE": "django.db.backends.mysql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username or "",
        "PASSWORD": parsed.password or "",
        "HOST": parsed.hostname or "localhost",
        "PORT": parsed.port or 3306,
        "OPTIONS": options,
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
    "skandan",
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

DB_ENGINE = _env("DB_ENGINE", default="")
DB_NAME = _env("DB_NAME", default="")
DB_USER = _env("DB_USER", default="")
DB_PASSWORD = _env("DB_PASSWORD", default="")
DB_HOST = _env("DB_HOST", default="")
DB_PORT = _env_int("DB_PORT", default=3306)
DB_SSL_MODE = _env("DB_SSL_MODE", default="REQUIRED")
DB_SSL_CA = _env("DB_SSL_CA", default="")
DB_SSL_VERIFY_CERT = _env_bool("DB_SSL_VERIFY_CERT", default=True)

use_env_db = (
    not _is_placeholder(DB_NAME)
    and not _is_placeholder(DB_USER)
    and not _is_placeholder(DB_PASSWORD)
    and not _is_placeholder(DB_HOST)
)

if use_env_db:
    db_options = {"charset": "utf8mb4", "init_command": "SET sql_mode='STRICT_TRANS_TABLES'"}
    if DB_SSL_MODE:
        ssl_config = {"ssl-mode": DB_SSL_MODE}
        if DB_SSL_CA:
            ssl_config["ca"] = DB_SSL_CA
        if not DB_SSL_VERIFY_CERT:
            ssl_config["ssl-verify-server-cert"] = False
        db_options["ssl"] = ssl_config
    DATABASES = {
        "default": {
            "ENGINE": DB_ENGINE or "django.db.backends.mysql",
            "NAME": DB_NAME,
            "USER": DB_USER,
            "PASSWORD": DB_PASSWORD,
            "HOST": DB_HOST,
            "PORT": DB_PORT,
            "OPTIONS": db_options,
        }
    }
    DB_CONFIG_SOURCE = "env"
else:
    DATABASES = {"default": _database_config(_env("DATABASE_URL", default=""))}
    DB_CONFIG_SOURCE = "DATABASE_URL"

logger.info("Database configuration source: %s", DB_CONFIG_SOURCE)

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
CLOUDINARY_CLOUD_NAME = _env("CLOUDINARY_CLOUD_NAME", default="")
CLOUDINARY_API_KEY = _env("CLOUDINARY_API_KEY", default="")
CLOUDINARY_API_SECRET = _env("CLOUDINARY_API_SECRET", default="")
CLOUDINARY_URL = _env("CLOUDINARY_URL", default="")
CLOUDINARY_SECURE = _env_bool("CLOUDINARY_SECURE", default=True)
CLOUDINARY_FOLDER = _env("CLOUDINARY_FOLDER", default="skandan")
CLOUDINARY_MAX_SIZE = _env_int("CLOUDINARY_MAX_SIZE", default=10 * 1024 * 1024)
CLOUDINARY_ALLOWED_FORMATS = [fmt.strip() for fmt in _env("CLOUDINARY_ALLOWED_FORMATS", default="jpg,jpeg,png,webp").split(",") if fmt.strip()]

DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

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
