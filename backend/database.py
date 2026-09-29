import os
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL must be configured; start the demo with npm start")
    if make_url(url).get_backend_name() != "sqlite":
        raise RuntimeError("This local demo requires a SQLite DATABASE_URL")
    return create_engine(url, pool_pre_ping=True, connect_args={"check_same_thread": False})


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(), class_=Session, autoflush=False, expire_on_commit=False
    )


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
