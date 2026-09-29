import pytest

from backend.database import get_engine


@pytest.fixture(autouse=True)
def clear_engine_cache():
    get_engine.cache_clear()
    yield
    get_engine.cache_clear()


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL must be configured"):
        get_engine()


def test_only_sqlite_is_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/demo")
    with pytest.raises(RuntimeError, match="requires a SQLite"):
        get_engine()


def test_sqlite_database_url_is_used(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    engine = get_engine()
    try:
        assert engine.url.drivername == "sqlite+pysqlite"
        with engine.connect() as connection:
            assert connection.exec_driver_sql("SELECT 1").scalar_one() == 1
    finally:
        engine.dispose()
