from rest_framework import serializers


class FaceRegisterSerializer(serializers.Serializer):
    selfies = serializers.ListField(child=serializers.FileField(), allow_empty=False)


class FaceVerifySerializer(serializers.Serializer):
    selfie = serializers.FileField()
