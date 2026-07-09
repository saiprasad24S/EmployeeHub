from django.urls import path

from apps.vision.views import FaceRegisterView, FaceVerifyView

urlpatterns = [
    path("register", FaceRegisterView.as_view(), name="face-register"),
    path("verify", FaceVerifyView.as_view(), name="face-verify"),
]
