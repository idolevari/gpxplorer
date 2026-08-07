import os
from functools import lru_cache

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


@lru_cache
def _jwks_client() -> pyjwt.PyJWKClient:
    url = os.getenv("SUPABASE_URL")
    if not url:
        # No default, ever — same fail-closed rationale as _jwt_secret: a
        # missing env var must never silently fall back to some other JWKS.
        raise RuntimeError("SUPABASE_URL is not set")
    return pyjwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json")


def _decode(token: str) -> str:
    try:
        header = pyjwt.get_unverified_header(token)
        alg = header.get("alg")
        if alg == "HS256":
            key = _jwt_secret()
        elif alg in ("ES256", "RS256"):
            key = _jwks_client().get_signing_key_from_jwt(token).key
        else:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        claims = pyjwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except HTTPException:
        raise
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
