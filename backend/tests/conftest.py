"""Test fixtures for PLINTH backend tests."""
import os
import sys

# Ensure backend directory is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Override DATABASE_URL before any imports
os.environ["DATABASE_URL"] = "sqlite:///./test_plinth.db"
os.environ["DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import User
from utils.security import hash_password, create_access_token

# Test database
TEST_DATABASE_URL = "sqlite:///./test_plinth.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test and drop after."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


@pytest.fixture
def client():
    """Test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def test_user(client):
    """Create a test user directly in the DB (bypasses rate-limited signup endpoint)."""
    db = TestSessionLocal()
    user = User(
        email="test@plinth.ai",
        hashed_password=hash_password("testpass123"),
        full_name="Test User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    user_id = user.id
    db.close()
    return {"email": "test@plinth.ai", "token": token, "id": user_id}


@pytest.fixture
def auth_headers(test_user):
    """Authorization headers for the test user."""
    return {"Authorization": f"Bearer {test_user['token']}"}


@pytest.fixture
def test_project(client, auth_headers):
    """Create a test project and return it."""
    response = client.post("/api/projects/", json={
        "name": "Test Project",
        "code": "TST-001",
        "typology": "residential",
        "location": "Test City",
        "budget": 1000000,
    }, headers=auth_headers)
    assert response.status_code == 201, f"Project creation failed: {response.text}"
    return response.json()
