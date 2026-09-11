import urllib.parse
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from apps.accounts.authentication import ClerkJWTAuthentication
from apps.communication.views import _get_or_create_authenticated_employee


@database_sync_to_async
def get_user_from_token(token: str):
    if not token:
        return AnonymousUser(), None
    try:
        auth = ClerkJWTAuthentication()
        # Mock a minimal request object with HTTP_AUTHORIZATION
        class MockRequest:
            META = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        
        user_auth = auth.authenticate(MockRequest())
        if not user_auth:
            return AnonymousUser(), None
        principal = user_auth[0]
        
        # Build mock request for resolving employee instance
        class MockEmployeeRequest:
            user = principal
        
        employee = _get_or_create_authenticated_employee(MockEmployeeRequest())
        return principal, employee
    except Exception as e:
        print(f"[WebSocket Auth Error] {e}")
        return AnonymousUser(), None


class ClerkJWTAuthMiddleware:
    """
    Custom Channels middleware that reads `?token=<clerk_jwt>` from query string,
    validates with Clerk JWKS, and sets `scope['user']` and `scope['employee']`.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        parsed = urllib.parse.parse_qs(query_string)
        token = parsed.get("token", [None])[0]

        principal, employee = await get_user_from_token(token)
        scope["user"] = principal
        scope["employee"] = employee

        return await self.inner(scope, receive, send)
