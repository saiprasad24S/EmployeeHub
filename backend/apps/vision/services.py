from __future__ import annotations

import hashlib
from io import BytesIO
from typing import Iterable

import numpy as np
from PIL import Image

try:
    import insightface
except Exception:  # pragma: no cover - optional runtime dependency
    insightface = None


class FaceRecognitionService:
    similarity_threshold = 0.55

    def __init__(self) -> None:
        self._model = None

    def _load_model(self):
        if self._model is None and insightface is not None:
            self._model = insightface.app.FaceAnalysis(name="buffalo_l")
            self._model.prepare(ctx_id=0, det_size=(640, 640))
        return self._model

    def generate_embedding(self, image_file) -> list[float]:
        image_bytes = image_file.read() if hasattr(image_file, "read") else image_file
        if hasattr(image_file, "seek"):
            image_file.seek(0)
        model = self._load_model()
        if model is None:
            digest = hashlib.sha256(image_bytes).digest()
            values = np.frombuffer(digest, dtype=np.uint8).astype(np.float32)
            return (values / 255.0).tolist()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        frame = np.array(image)[:, :, ::-1]
        faces = model.get(frame)
        if not faces:
            raise ValueError("No face detected.")
        return faces[0].embedding.astype(float).tolist()

    def compare_with_store(self, incoming_embedding: list[float], stored_embeddings) -> float:
        if not stored_embeddings:
            return 0.0
        incoming = np.array(incoming_embedding, dtype=np.float32)
        if isinstance(stored_embeddings, list) and stored_embeddings and isinstance(stored_embeddings[0], list):
            candidates = stored_embeddings
        else:
            candidates = [stored_embeddings]
        scores = []
        for candidate in candidates:
            stored = np.array(candidate, dtype=np.float32)
            denominator = np.linalg.norm(incoming) * np.linalg.norm(stored)
            if denominator == 0:
                scores.append(0.0)
                continue
            scores.append(float(np.dot(incoming, stored) / denominator))
        return max(scores) if scores else 0.0


class LivenessService:
    minimum_liveness_score = 0.75

    def is_live(self, image_file, liveness_score: float | None = None) -> bool:
        if liveness_score is not None:
            return float(liveness_score) >= self.minimum_liveness_score
        image_bytes = image_file.read() if hasattr(image_file, "read") else image_file
        if hasattr(image_file, "seek"):
            image_file.seek(0)
        return len(image_bytes) > 0
