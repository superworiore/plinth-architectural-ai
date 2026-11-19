"""Authentication tests."""
from datetime import timedelta


def test_signup_success(client):
    response = client.post("/api/auth/signup", json={
        "email": "new@plinth.ai",
        "password": "password123",
        "full_name": "New User",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_signup_duplicate_email(client, test_user):
    response = client.post("/api/auth/signup", json={
        "email": "test@plinth.ai",
        "password": "password123",
        "full_name": "Duplicate",
    })
    assert response.status_code == 409


def test_login_success(client, test_user):
    response = client.post("/api/auth/login", json={
        "email": "test@plinth.ai",
        "password": "testpass123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_login_wrong_password(client, test_user):
    response = client.post("/api/auth/login", json={
        "email": "test@plinth.ai",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    response = client.post("/api/auth/login", json={
        "email": "nobody@plinth.ai",
        "password": "password123",
    })
    assert response.status_code == 401


def test_me_with_valid_token(client, test_user):
    response = client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {test_user['token']}"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@plinth.ai"
    assert data["full_name"] == "Test User"


def test_me_without_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 403  # HTTPBearer returns 403 when no credentials


def test_me_with_invalid_token(client):
    response = client.get("/api/auth/me", headers={
        "Authorization": "Bearer invalid.token.here"
    })
    assert response.status_code == 401


def test_me_with_expired_token(client):
    """Test that an expired token is rejected."""
    from utils.security import create_access_token
    token = create_access_token({"sub": "fake-user-id"}, expires_delta=timedelta(seconds=-1))
    response = client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 401


def test_protected_endpoint_without_auth(client):
    response = client.get("/api/projects/")
    assert response.status_code == 403
