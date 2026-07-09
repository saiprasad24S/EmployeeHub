from __future__ import annotations

import functools
from typing import Any

import jwt
import requests
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.models import Admin, Employee
from apps.common.utils import AuthenticatedPrincipal


@functools.lru_cache(maxsize=1)
def _get_jwks_client() -> jwt.PyJWKClient:
    if not settings.CLERK_JWKS_URL:
        raise AuthenticationFailed("Clerk JWKS URL is not configured.")
    return jwt.PyJWKClient(settings.CLERK_JWKS_URL)


class ClerkJWTAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request) -> tuple[AuthenticatedPrincipal, str] | None:
        auth_header = get_authorization_header(request).split()
        if not auth_header:
            return None
        if auth_header[0].lower() != self.keyword.lower().encode():
            return None
        if len(auth_header) != 2:
            raise AuthenticationFailed("Invalid authorization header.")

        token = auth_header[1].decode()
        principal = self._authenticate_token(token)
        return principal, token

    def _authenticate_token(self, token: str) -> AuthenticatedPrincipal:
        try:
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=settings.CLERK_AUDIENCE or None,
                issuer=settings.CLERK_ISSUER or None,
                options={"verify_aud": bool(settings.CLERK_AUDIENCE), "verify_iss": bool(settings.CLERK_ISSUER)},
            )
        except Exception as exc:  # pragma: no cover - security path
            raise AuthenticationFailed("Invalid Clerk session.") from exc

        email = claims.get("email") or claims.get("email_address")
        if not email:
            raise AuthenticationFailed("Clerk session is missing an email address.")

        employee = Employee.objects.filter(email__iexact=email).first()
        admin = Admin.objects.filter(email__iexact=email).first()
        if admin:
            return AuthenticatedPrincipal(
                email=email,
                role="ADMIN",
                admin_id=admin.id,
                clerk_subject=claims.get("sub"),
            )
        if employee:
            return AuthenticatedPrincipal(
                email=email,
                role="EMPLOYEE",
                employee_id=employee.id,
                clerk_subject=claims.get("sub"),
            )
        raise AuthenticationFailed("You are not an employee of Skandan.")
