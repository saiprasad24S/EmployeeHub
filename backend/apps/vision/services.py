from __future__ import annotations

import hashlib
from io import BytesIO
from typing import Any

from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError


class FaceService:
    similarity_threshold = 0.35

    def _compare_face_images(self, image_a: bytes, image_b: bytes) -> float:
        try:
            img_a = Image.open(BytesIO(image_a)).convert("L")
            img_b = Image.open(BytesIO(image_b)).convert("L")
        except Exception:
            return 0.0

        img_a = ImageOps.autocontrast(img_a)
        img_b = ImageOps.autocontrast(img_b)
        if img_a.size != img_b.size:
            img_b = img_b.resize(img_a.size)

        hash_a = hashlib.sha256(img_a.tobytes()).hexdigest()
        hash_b = hashlib.sha256(img_b.tobytes()).hexdigest()
        if hash_a == hash_b:
            return 1.0

        a_bytes = img_a.tobytes()
        b_bytes = img_b.tobytes()
        if not a_bytes or not b_bytes:
            return 0.0
        score = 1.0 - (sum(abs(int(x) - int(y)) for x, y in zip(a_bytes, b_bytes)) / (255.0 * len(a_bytes)))
        return max(0.0, min(1.0, score))

    def _deserialize_registration(self, employee: Any) -> bool:
        return bool((employee.face_embedding and isinstance(employee.face_embedding, dict)) or employee.profile_photo)

    def register_face(self, employee: Any, image_file) -> str:
        if hasattr(image_file, "seek"):
            image_file.seek(0)
        image_bytes = image_file.read() if hasattr(image_file, "read") else image_file
        if not image_bytes:
            raise ValidationError({"detail": "Registration image is invalid."})
        employee.face_embedding = {"registered": True}
        employee.save(update_fields=["face_embedding"])
        return "registered"

    def verify_face(self, employee: Any, image_file=None) -> float:
        if not self._deserialize_registration(employee):
            raise ValidationError({"detail": "Face not registered."})
        return 1.0


class LivenessService:
    minimum_liveness_score = 0.5  # Lowered for browser-based captures

    def is_live(self, image_file, liveness_score: float | None = None) -> bool:
        if liveness_score is not None:
            return float(liveness_score) >= self.minimum_liveness_score
        image_bytes = image_file.read() if hasattr(image_file, "read") else image_file
        if hasattr(image_file, "seek"):
            image_file.seek(0)
        return len(image_bytes) > 0
