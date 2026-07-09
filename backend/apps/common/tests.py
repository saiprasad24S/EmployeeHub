from django.test import SimpleTestCase

from apps.common.utils import distance_meters


class DistanceUtilsTests(SimpleTestCase):
    def test_zero_distance(self):
        self.assertAlmostEqual(distance_meters(12.9716, 77.5946, 12.9716, 77.5946), 0.0, places=6)

    def test_distance_is_symmetric(self):
        forward = distance_meters(12.9716, 77.5946, 12.9751, 77.6089)
        backward = distance_meters(12.9751, 77.6089, 12.9716, 77.5946)
        self.assertAlmostEqual(forward, backward, places=6)
