from __future__ import annotations

import time
from typing import Any

import jwt
import requests
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.models import Admin, Employee
from apps.common.utils import AuthenticatedPrincipal


# ---- Cached JWKS fetcher (avoids PyJWKClient HTTP issues) ----
_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0}
_JWKS_CACHE_TTL = 3600  # 1 hour


def _fetch_jwks() -> list[dict]:
    """Fetch JWKS keys from Clerk and cache them for 1 hour."""
    now = time.time()
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < _JWKS_CACHE_TTL:
        return _jwks_cache["keys"]

    jwks_url = settings.CLERK_JWKS_URL
    if not jwks_url:
        raise AuthenticationFailed("Clerk JWKS URL is not configured.")

    try:
        response = requests.get(jwks_url, timeout=10, headers={"Accept": "application/json"})
        response.raise_for_status()
        data = response.json()
        keys = data.get("keys", [])
        if not keys:
            raise AuthenticationFailed("No signing keys found in Clerk JWKS response.")
        _jwks_cache["keys"] = keys
        _jwks_cache["fetched_at"] = now
        print(f"[AUTH] JWKS keys fetched successfully: {len(keys)} key(s)")
        return keys
    except requests.RequestException as exc:
        # If we have cached keys, use them even if expired
        if _jwks_cache["keys"]:
            print(f"[AUTH WARNING] JWKS fetch failed ({exc}), using cached keys")
            return _jwks_cache["keys"]
        raise AuthenticationFailed(f"Failed to fetch Clerk JWKS keys: {exc}") from exc


def _get_signing_key(token: str):
    """Get the signing key for a JWT token from cached JWKS."""
    keys = _fetch_jwks()
    # Parse the token header to find kid
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")

    for key_data in keys:
        if key_data.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    # If kid not found, try first key (Clerk usually has one)
    if keys:
        return jwt.algorithms.RSAAlgorithm.from_jwk(keys[0])

    raise AuthenticationFailed("No matching signing key found for token.")


def _fetch_clerk_user_email(user_id: str) -> str:
    """Fetch the user's primary email from Clerk Backend API using their user ID."""
    secret_key = settings.CLERK_SECRET_KEY
    if not secret_key:
        raise AuthenticationFailed("Clerk Secret Key is not configured.")

    try:
        url = f"https://api.clerk.com/v1/users/{user_id}"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {secret_key}",
                "Accept": "application/json"
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # Find primary email address
        primary_email_id = data.get("primary_email_address_id")
        email_addresses = data.get("email_addresses", [])
        
        for email_data in email_addresses:
            if email_data.get("id") == primary_email_id:
                return email_data.get("email_address")
                
        if email_addresses:
            return email_addresses[0].get("email_address")
            
        raise AuthenticationFailed("No email address associated with this Clerk account.")
    except requests.RequestException as exc:
        raise AuthenticationFailed(f"Failed to retrieve user profile from Clerk API: {exc}") from exc


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
            signing_key = _get_signing_key(token)
            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                leeway=120,
                options={"verify_aud": False, "verify_iss": False},
            )
        except AuthenticationFailed:
            raise
        except Exception as exc:
            print(f"[AUTH ERROR] Clerk authentication failed: {exc}")
            raise AuthenticationFailed(f"Invalid Clerk session. Details: {exc}") from exc

        email = claims.get("email") or claims.get("email_address")
        if not email:
            # Fall back to Clerk Backend API using the subject ID (User ID)
            user_id = claims.get("sub")
            if not user_id:
                raise AuthenticationFailed("Clerk session is missing both email and user ID.")
            print(f"[AUTH] Email missing in token. Fetching from Clerk API for user ID: {user_id}")
            email = _fetch_clerk_user_email(user_id)

        print(f"[AUTH] Extracted email: {email}")

        # Support both spellings as ADMIN to avoid typos
        if email.lower() in ("skandanhomecare@gmail.com", "skandanhomecarre@gmail.com"):
            admin, _ = Admin.objects.get_or_create(
                email=email.lower(), defaults={"name": "Skandan Admin", "role": "SUPER_ADMIN"}
            )
            return AuthenticatedPrincipal(
                email=email,
                role="ADMIN",
                admin_id=admin.id,
                clerk_subject=claims.get("sub"),
            )

        employee = Employee.objects.filter(email__iexact=email).first()
        if employee:
            return AuthenticatedPrincipal(
                email=email,
                role="EMPLOYEE",
                employee_id=employee.id,
                clerk_subject=claims.get("sub"),
            )
        raise AuthenticationFailed("You are not registered in the system.")
