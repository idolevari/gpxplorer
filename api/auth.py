import os

import jwt as pyjwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


def _jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        # No default, ever. A defaulted secret would let a forgotten prod env
        # var validate tokens signed with the publicly-known local secret.
        raise RuntimeError("SUPABASE_JWT_SECRET is not set")
    return secret


def _decode(token: str) -> str:
    try:
        claims = pyjwt.decode(
            token, _jwt_secret(), algorithms=["HS256"], audience="authenticated"
        )
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token has no subject")
    return sub


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _decode(credentials.credentials)


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    if credentials is None:
        return None
    return _decode(credentials.credentials)
