from __future__ import annotations

import io
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import cloudinary
import cloudinary.api
import cloudinary.uploader
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_BYTES = int(getattr(settings, "CLOUDINARY_MAX_SIZE", 10 * 1024 * 1024))


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def initialize_cloudinary() -> bool:
    cloud_name = _env("CLOUDINARY_CLOUD_NAME", default=getattr(settings, "CLOUDINARY_CLOUD_NAME", ""))
    api_key = _env("CLOUDINARY_API_KEY", default=getattr(settings, "CLOUDINARY_API_KEY", ""))
    api_secret = _env("CLOUDINARY_API_SECRET", default=getattr(settings, "CLOUDINARY_API_SECRET", ""))
    cloudinary_url = _env("CLOUDINARY_URL", default=getattr(settings, "CLOUDINARY_URL", ""))

    if cloud_name and api_key and api_secret:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=_env("CLOUDINARY_SECURE", default="true").lower() in {"1", "true", "yes", "on"},
        )
    elif cloudinary_url:
        cloudinary.config(secure=_env("CLOUDINARY_SECURE", default="true").lower() in {"1", "true", "yes", "on"})
    else:
        logger.error("✗ Cloudinary Connection Failed")
        return False

    try:
        cloudinary.api.ping()
        logger.info("✓ Cloudinary Connected Successfully")
        return True
    except Exception as exc:  # pragma: no cover - runtime validation path
        logger.error("✗ Cloudinary Connection Failed: %s", exc)
        return False


def cloudinary_status() -> dict[str, Any]:
    cloud_name = _env("CLOUDINARY_CLOUD_NAME", default=getattr(settings, "CLOUDINARY_CLOUD_NAME", ""))
    if not cloud_name:
        return {"status": "error", "cloud_name": "", "message": "Cloudinary is not configured"}

    try:
        cloudinary.api.ping()
        return {"status": "connected", "cloud_name": cloud_name}
    except Exception as exc:  # pragma: no cover - runtime validation path
        return {"status": "error", "cloud_name": cloud_name, "message": str(exc)}


def validate_upload_file(image_file, *, max_size_bytes: int | None = None) -> None:
    if image_file is None:
        raise ValueError("No file provided")

    file_name = getattr(image_file, "name", "") or "upload"
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file format")

    if not getattr(image_file, "content_type", ""):
        raise ValueError("Missing content type")
    if getattr(image_file, "content_type", "") not in ALLOWED_MIME_TYPES and not file_name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise ValueError("Unsupported file format")

    size_limit = max_size_bytes or MAX_IMAGE_SIZE_BYTES
    image_file.seek(0)
    data = image_file.read()
    if len(data) > size_limit:
        raise ValueError("File exceeds the 10 MB limit")
    image_file.seek(0)


def _load_image(image_file) -> Image.Image:
    image_file.seek(0)
    return Image.open(image_file).convert("RGBA")


def _get_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "Poppins-Regular.ttf",
        "Poppins-Bold.ttf",
        "poppins.ttf",
        "poppins-bold.ttf",
        "DejaVuSans-Bold.ttf",
        "arial.ttf",
        "Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _build_watermark(image: Image.Image, metadata: dict[str, Any]) -> Image.Image:
    width, height = image.size
    padding = 15
    box_padding = 10
    text_color = "white"
    font_size = max(18, int(min(width, height) / 40))
    font = _get_font(font_size)

    lines = [
        f"Employee: {metadata.get('employee_name', 'Unknown')}",
        f"Employee ID: {metadata.get('employee_id', 'N/A')}",
        f"Date: {metadata.get('date', datetime.now().strftime('%d-%b-%Y'))}",
        f"Time: {metadata.get('time', datetime.now().strftime('%I:%M:%S %p'))}",
        "Location:",
        metadata.get('address', 'Address unavailable') or 'Address unavailable',
        f"Lat: {metadata.get('latitude', 'N/A')}",
        f"Lng: {metadata.get('longitude', 'N/A')}",
    ]

    optional_fields = []
    if metadata.get("battery_percentage") is not None:
        optional_fields.append(f"Battery: {metadata.get('battery_percentage')}%")
    if metadata.get("network_type"):
        optional_fields.append(f"Network: {metadata.get('network_type')}")
    if metadata.get("device_name"):
        optional_fields.append(f"Device: {metadata.get('device_name')}")
    if optional_fields:
        lines.extend(optional_fields)

    text_width = max([font.getbbox(line)[2] for line in lines]) if lines else 0
    text_height = sum([font.getbbox(line)[3] - font.getbbox(line)[1] for line in lines]) + (len(lines) - 1) * 4
    box_width = text_width + padding * 2
    box_height = text_height + padding * 2
    x0 = padding
    y0 = height - box_height - padding

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle([x0, y0, x0 + box_width + box_padding, y0 + box_height + box_padding], radius=10, fill=(0, 0, 0, 180))
    draw.text((x0 + padding, y0 + padding), "\n".join(lines), fill=(255, 255, 255, 255), font=font)
    return Image.alpha_composite(image, overlay)


def _compress_and_prepare(image_file, metadata: dict[str, Any]) -> io.BytesIO:
    image = _load_image(image_file)
    image = _build_watermark(image, metadata)
    width, height = image.size
    max_dimension = 1920
    if max(width, height) > max_dimension:
        scale = max_dimension / max(width, height)
        image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    output = io.BytesIO()
    ext = Path(getattr(image_file, "name", "upload.jpg")).suffix.lower()
    if ext in {".jpg", ".jpeg"}:
        image.convert("RGB").save(output, format="JPEG", quality=80, optimize=True)
    elif ext == ".png":
        image.save(output, format="PNG", optimize=True)
    else:
        image.convert("RGB").save(output, format="WEBP", quality=80, optimize=True)
    output.seek(0)
    return output


def _get_folder_path(kind: str, employee_id: str, *, patient_id: str | None = None, date_str: str | None = None) -> str:
    base_folder = _env("CLOUDINARY_FOLDER", default=getattr(settings, "CLOUDINARY_FOLDER", "skandan"))
    if kind == "attendance":
        return f"{base_folder}/attendance/{employee_id}/{date_str or datetime.now().strftime('%Y-%m-%d')}"
    if kind == "profile":
        return f"{base_folder}/profile/{employee_id}"
    if kind == "patient-visit":
        return f"{base_folder}/patient-visits/{employee_id}/{patient_id or 'unknown'}"
    if kind == "document":
        return f"{base_folder}/documents/{employee_id}"
    return base_folder


def _build_public_id(kind: str, employee_id: str, *, file_name: str, patient_id: str | None = None, date_str: str | None = None) -> str:
    folder = _get_folder_path(kind, employee_id, patient_id=patient_id, date_str=date_str)
    file_stem = Path(file_name).stem
    return f"{folder}/{file_stem}"


def upload_image(
    image_file,
    *,
    kind: str,
    employee_id: str,
    file_name: str,
    metadata: dict[str, Any] | None = None,
    patient_id: str | None = None,
    date_str: str | None = None,
) -> dict[str, Any]:
    validate_upload_file(image_file)
    prepared = _compress_and_prepare(image_file, metadata or {})
    folder = _get_folder_path(kind, employee_id, patient_id=patient_id, date_str=date_str)
    public_id = _build_public_id(kind, employee_id, file_name=file_name, patient_id=patient_id, date_str=date_str)
    result = cloudinary.uploader.upload(
        prepared,
        folder=folder,
        public_id=public_id,
        resource_type="image",
        overwrite=True,
        unique_filename=False,
        use_filename=False,
    )
    return {
        "url": result.get("secure_url") or result.get("url") or "",
        "public_id": result.get("public_id") or public_id,
        "secure_url": result.get("secure_url") or result.get("url") or "",
    }


def upload_attendance_image(image_file, *, employee_id: str, attendance_type: str, timestamp: str | None = None, latitude: float | None = None, longitude: float | None = None, address: str | None = None, employee_name: str | None = None, battery_percentage: int | None = None, network_type: str | None = None, device_name: str | None = None) -> dict[str, Any]:
    dt = datetime.now()
    if timestamp:
        try:
            parsed = datetime.fromisoformat(timestamp)
            dt = parsed
        except ValueError:
            pass

    date_str = dt.strftime("%Y-%m-%d")
    time_str = dt.strftime("%I:%M:%S %p")
    file_name = f"{employee_id}_{dt.strftime('%Y%m%d_%H%M%S')}_{attendance_type.lower()}.jpg"
    metadata = {
        "employee_name": employee_name or employee_id,
        "employee_id": employee_id,
        "date": dt.strftime("%d-%b-%Y"),
        "time": time_str,
        "address": address or "Address unavailable",
        "latitude": latitude if latitude is not None else "N/A",
        "longitude": longitude if longitude is not None else "N/A",
        "battery_percentage": battery_percentage,
        "network_type": network_type,
        "device_name": device_name,
    }
    return upload_image(
        image_file,
        kind="attendance",
        employee_id=employee_id,
        file_name=file_name,
        metadata=metadata,
        date_str=date_str,
    )


def upload_profile_image(image_file, *, employee_id: str, employee_name: str | None = None) -> dict[str, Any]:
    file_name = f"{employee_id}_profile.jpg"
    metadata = {"employee_name": employee_name or employee_id, "employee_id": employee_id}
    return upload_image(image_file, kind="profile", employee_id=employee_id, file_name=file_name, metadata=metadata)


def upload_patient_visit_image(image_file, *, employee_id: str, patient_id: str, employee_name: str | None = None) -> dict[str, Any]:
    dt = datetime.now()
    file_name = f"{employee_id}_{patient_id}_{dt.strftime('%Y%m%d_%H%M%S')}.jpg"
    metadata = {"employee_name": employee_name or employee_id, "employee_id": employee_id}
    return upload_image(image_file, kind="patient-visit", employee_id=employee_id, file_name=file_name, patient_id=patient_id, metadata=metadata)


def upload_document(image_file, *, employee_id: str, file_name: str) -> dict[str, Any]:
    return upload_image(image_file, kind="document", employee_id=employee_id, file_name=file_name, metadata={})


def delete_image(public_id: str) -> bool:
    if not public_id:
        return False
    result = cloudinary.uploader.destroy(public_id, invalidate=True)
    return bool(result.get("result") == "ok")


def delete_image_from_url(url: str) -> bool:
    if not url:
        return False
    try:
        public_id = url.split("/upload/")[-1].split(".")[0]
        if "/" in public_id:
            public_id = public_id.split("/", 1)[1]
        return delete_image(public_id)
    except Exception:
        return False


def get_image_url(public_id: str) -> str:
    if not public_id:
        return ""
    return cloudinary.CloudinaryImage(public_id).build_url(secure=True)
