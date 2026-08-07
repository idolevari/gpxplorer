import time

import jwt as pyjwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

TEST_SECRET = "test-secret-that-is-at-least-32-chars-long!!"
USER_ID = "11111111-1111-1111-1111-111111111111"


def make_token(secret=TEST_SECRET, aud="authenticated", sub=USER_ID, exp_delta=3600):
    return pyjwt.encode(
        {"sub": sub, "aud": aud, "role": "authenticated",
         "exp": int(time.time()) + exp_delta},
        secret, algorithm="HS256",
    )


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    from auth import get_current_user_id, get_optional_user_id

    app = FastAPI()

    @app.get("/whoami")
    def whoami(user_id: str = Depends(get_current_user_id)):
        return {"user_id": user_id}

    @app.get("/maybe")
    def maybe(user_id: str | None = Depends(get_optional_user_id)):
        return {"user_id": user_id}

    return TestClient(app)


def test_valid_token_yields_user_id(client):
    res = client.get("/whoami", headers={"Authorization": f"Bearer {make_token()}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": USER_ID}


def test_missing_token_is_401(client):
    assert client.get("/whoami").status_code == 401


def test_expired_token_is_401(client):
    tok = make_token(exp_delta=-60)
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_wrong_secret_is_401(client):
    tok = make_token(secret="another-wrong-secret-also-32-chars-long!!")
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_wrong_audience_is_401(client):
    tok = make_token(aud="anon")
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_optional_allows_anonymous(client):
    res = client.get("/maybe")
    assert res.status_code == 200
    assert res.json() == {"user_id": None}


def test_optional_still_rejects_a_bad_token(client):
    """A garbage token is an error, not anonymity — silently downgrading a
    broken session to anonymous would mask real client bugs."""
    res = client.get("/maybe", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401


def test_missing_env_fails_closed(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    from auth import _jwt_secret
    with pytest.raises(RuntimeError, match="SUPABASE_JWT_SECRET"):
        _jwt_secret()


def test_es256_token_verifies_via_jwks(monkeypatch, client):
    """Real Supabase sessions are ES256-signed; HS256-only verification 401s
    every real user while forged-HS256 unit tests stay green."""
    from cryptography.hazmat.primitives.asymmetric import ec
    private_key = ec.generate_private_key(ec.SECP256R1())
    tok = pyjwt.encode(
        {"sub": USER_ID, "aud": "authenticated", "role": "authenticated",
         "exp": int(time.time()) + 3600},
        private_key, algorithm="ES256", headers={"kid": "test-key"},
    )

    class StubJWKS:
        def get_signing_key_from_jwt(self, _token):
            class K:
                key = private_key.public_key()
            return K()

    import auth
    monkeypatch.setattr(auth, "_jwks_client", lambda: StubJWKS())
    res = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": USER_ID}


def test_es256_with_wrong_key_is_401(monkeypatch, client):
    from cryptography.hazmat.primitives.asymmetric import ec
    signing = ec.generate_private_key(ec.SECP256R1())
    other = ec.generate_private_key(ec.SECP256R1())
    tok = pyjwt.encode(
        {"sub": USER_ID, "aud": "authenticated", "role": "authenticated",
         "exp": int(time.time()) + 3600},
        signing, algorithm="ES256", headers={"kid": "k"},
    )

    class StubJWKS:
        def get_signing_key_from_jwt(self, _token):
            class K:
                key = other.public_key()
            return K()

    import auth
    monkeypatch.setattr(auth, "_jwks_client", lambda: StubJWKS())
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_unknown_alg_is_401(client):
    # alg=none classic
    header = pyjwt.utils.base64url_encode(b'{"alg":"none","typ":"JWT"}').decode()
    payload = pyjwt.utils.base64url_encode(b'{"sub":"x","aud":"authenticated"}').decode()
    tok = f"{header}.{payload}."
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 401
