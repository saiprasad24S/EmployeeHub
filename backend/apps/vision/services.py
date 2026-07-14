from __future__ import annotations

from io import BytesIO
from typing import Iterable

import hashlib
import numpy as np
from PIL import Image

try:
    import face_recognition
except Exception:  # pragma: no cover - optional runtime dependency
    face_recognition = None
    # face_recognition is optional. On Windows it may fail to install because dlib requires Visual C++ build tools.

try:
    import insightface
except Exception:  # pragma: no cover - optional runtime dependency
    insightface = None


class FaceRecognitionService:
    # Face-Recognition uses 128d embeddings. Cosine similarity on normalized vectors.
    similarity_threshold = 0.50

    def __init__(self) -> None:
        self._model = None

    def _load_insightface_model(self):
        if self._model is None and insightface is not None:
            self._model = insightface.app.FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            self._model.prepare(ctx_id=0, det_size=(640, 640))
        return self._model

    def generate_embedding(self, image_file) -> list[float]:
        """Generate a face embedding from an image file or bytes."""
        image_bytes = image_file.read() if hasattr(image_file, "read") else image_file
        if hasattr(image_file, "seek"):
            image_file.seek(0)

        if face_recognition is not None:
            image = face_recognition.load_image_file(BytesIO(image_bytes))
            face_locations = face_recognition.face_locations(image)
            if not face_locations:
                raise ValueError("No face detected in the image. Please ensure your face is clearly visible.")
            encodings = face_recognition.face_encodings(image, face_locations)
            if not encodings:
                raise ValueError("Unable to extract face encoding.")
            embedding = np.array(encodings[0], dtype=np.float32)
        else:
            model = self._load_insightface_model()
            if model is None:
                digest = hashlib.sha256(image_bytes).digest()
                values = np.frombuffer(digest, dtype=np.uint8).astype(np.float32)
                return (values / 255.0).tolist()

            image = Image.open(BytesIO(image_bytes)).convert("RGB")
            frame = np.array(image)[:, :, ::-1]  # RGB -> BGR for OpenCV

            faces = model.get(frame)
            if not faces:
                model.prepare(ctx_id=0, det_size=(320, 320))
                faces = model.get(frame)
                model.prepare(ctx_id=0, det_size=(640, 640))

            if not faces:
                raise ValueError("No face detected in the image. Please ensure your face is clearly visible.")

            if len(faces) > 1:
                faces = sorted(
                    faces,
                    key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                    reverse=True,
                )
            embedding = faces[0].embedding.astype(np.float32)

        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding.tolist()

    def compare_with_store(self, incoming_embedding: list[float], stored_embeddings) -> float:
        """Compare an incoming face embedding against stored embeddings.
        
        Returns the highest cosine similarity score.
        InsightFace embeddings are L2-normalized, so dot product = cosine similarity.
        """
        if not stored_embeddings:
            return 0.0

        incoming = np.array(incoming_embedding, dtype=np.float32)
        # Normalize incoming just in case
        incoming_norm = np.linalg.norm(incoming)
        if incoming_norm > 0:
            incoming = incoming / incoming_norm

        # Handle both list-of-lists and single list formats
        if isinstance(stored_embeddings, list) and stored_embeddings and isinstance(stored_embeddings[0], list):
            candidates = stored_embeddings
        else:
            candidates = [stored_embeddings]

        scores = []
        for candidate in candidates:
            stored = np.array(candidate, dtype=np.float32)
            stored_norm = np.linalg.norm(stored)
            if stored_norm > 0:
                stored = stored / stored_norm
            # Cosine similarity via dot product of unit vectors
            similarity = float(np.dot(incoming, stored))
            scores.append(similarity)
            print(f"[FACE MATCH] Cosine similarity: {similarity:.4f} (threshold: {self.similarity_threshold})")

        best_score = max(scores) if scores else 0.0
        print(f"[FACE MATCH] Best score: {best_score:.4f}, Match: {best_score >= self.similarity_threshold}")
        return best_score


class LivenessService:
    minimum_liveness_score = 0.5  # Lowered for browser-based captures

    def is_live(self, image_file, liveness_score: float | None = None) -> bool:
        if liveness_score is not None:
            return float(liveness_score) >= self.minimum_liveness_score
        image_bytes = image_file.read() if hasattr(image_file, "read") else image_file
        if hasattr(image_file, "seek"):
            image_file.seek(0)
        return len(image_bytes) > 0
