from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import create_app
from backend.database import get_db
from backend.models import Base, Improvement
from backend.services import ImprovementPersistenceError


@pytest.fixture
def session_factory() -> Generator[sessionmaker[Session], None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(session_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    application = create_app()

    def override_db() -> Generator[Session, None, None]:
        with session_factory() as session:
            yield session

    application.dependency_overrides[get_db] = override_db
    with TestClient(application) as test_client:
        yield test_client


def valid_proposal() -> dict[str, str]:
    return {
        "name": "Alex Morgan",
        "email": "alex@company.com",
        "area": "engineering",
        "title": "Reduce build feedback time",
        "description": "Cache unchanged application bundles in continuous integration.",
        "expectedImpact": "high",
    }


def test_health_is_independent_of_database(client: TestClient) -> None:
    with patch("backend.database.get_engine", side_effect=AssertionError):
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_submit_improvement_returns_receipt_and_persists(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    response = client.post("/improvements", json=valid_proposal())

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "referenceNumber", "status", "createdAt"}
    assert body["referenceNumber"].startswith("IH-")
    assert body["status"] == "Submitted"

    with session_factory() as session:
        saved = session.get(Improvement, body["id"])
        assert saved is not None
        assert saved.name == "Alex Morgan"
        assert saved.title == "Reduce build feedback time"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "   "),
        ("email", "not-an-email"),
        ("area", "finance"),
        ("title", "x" * 101),
        ("description", ""),
        ("expectedImpact", "critical"),
    ],
)
def test_submit_rejects_invalid_fields(
    client: TestClient, field: str, value: str
) -> None:
    proposal = valid_proposal()
    proposal[field] = value
    response = client.post("/improvements", json=proposal)
    assert response.status_code == 422


def test_submit_rejects_missing_required_field(client: TestClient) -> None:
    proposal = valid_proposal()
    del proposal["description"]
    response = client.post("/improvements", json=proposal)
    assert response.status_code == 422


def test_submit_returns_stable_error_when_database_fails(client: TestClient) -> None:
    with patch(
        "backend.routers.improvements.submit_improvement",
        side_effect=ImprovementPersistenceError(),
    ):
        response = client.post("/improvements", json=valid_proposal())
    assert response.status_code == 503
    assert response.json() == {"detail": "Unable to submit proposal at this time."}


def test_cors_allows_local_web_frontend(client: TestClient) -> None:
    for origin in ("http://localhost:4200", "http://127.0.0.1:4200"):
        response = client.options(
            "/improvements",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_cors_allows_configured_web_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " https://qa.example.com, https://demo.example.com ")
    with TestClient(create_app()) as client:
        for origin in ("https://qa.example.com", "https://demo.example.com"):
            response = client.options(
                "/improvements",
                headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin


def test_cors_rejects_unconfigured_origin(client: TestClient) -> None:
    response = client.options(
        "/improvements",
        headers={
            "Origin": "https://untrusted.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("environment", ["prod", "dev"])
def test_local_environments_offer_api_documentation(
    monkeypatch: pytest.MonkeyPatch, environment: str
) -> None:
    monkeypatch.setenv("APP_ENV", environment)
    application = create_app()
    assert application.docs_url == "/docs"
    assert application.redoc_url == "/redoc"
    assert application.openapi_url == "/openapi.json"
