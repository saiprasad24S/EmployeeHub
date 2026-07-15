import logging
import os
import time

from django.apps import AppConfig
from django.conf import settings
from django.db import connections

logger = logging.getLogger(__name__)


class SkandanConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "skandan"

    def ready(self):
        self._validate_database_connection()

    def _validate_database_connection(self) -> None:
        if os.getenv("SKIP_DB_STARTUP_VALIDATION", "").lower() in {"1", "true", "yes", "on"}:
            logger.info("Database startup validation skipped by configuration.")
            return

        engine = settings.DATABASES["default"].get("ENGINE", "")
        if "sqlite" in engine:
            logger.info("Database startup validation skipped for the SQLite backend.")
            return

        attempts = int(os.getenv("DB_STARTUP_RETRIES", "3"))
        delay_seconds = int(os.getenv("DB_STARTUP_RETRY_DELAY_SECONDS", "2"))

        for attempt in range(1, attempts + 1):
            try:
                connection = connections["default"]
                connection.ensure_connection()
                logger.info("Database connection validated successfully using %s.", engine)
                return
            except Exception as exc:  # pragma: no cover - exercised only at runtime
                if attempt < attempts:
                    logger.warning(
                        "Database connection attempt %s/%s failed: %s",
                        attempt,
                        attempts,
                        exc,
                    )
                    time.sleep(delay_seconds)
                else:
                    logger.error(
                        "Database startup validation failed after %s attempts: %s",
                        attempts,
                        exc,
                    )
