import os
import sys
from pathlib import Path

# Add backend directory to sys.path so skandan and apps modules can be imported in serverless runtimes
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "skandan.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
app = application


