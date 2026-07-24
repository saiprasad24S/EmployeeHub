from io import BytesIO

from PIL import Image
from django.test import SimpleTestCase

from apps.vision.services import FaceService


class FaceServiceFallbackTests(SimpleTestCase):
    def setUp(self) -> None:
        self.service = FaceService()

    def _jpeg_bytes(self, color: tuple[int, int, int]) -> bytes:
        image = Image.new("RGB", (64, 64), color)
        buffer = BytesIO()
        image.save(buffer, format="JPEG")
        return buffer.getvalue()

    def test_local_similarity_returns_high_score_for_identical_images(self) -> None:
        image_bytes = self._jpeg_bytes((255, 0, 0))
        score = self.service._compare_face_images(image_bytes, image_bytes)
        self.assertGreaterEqual(score, 0.95)

    def test_local_similarity_returns_low_score_for_different_images(self) -> None:
        red_image = self._jpeg_bytes((255, 0, 0))
        blue_image = self._jpeg_bytes((0, 0, 255))
        score = self.service._compare_face_images(red_image, blue_image)
        self.assertLess(score, 0.95)
