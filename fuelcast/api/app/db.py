import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

def normalize_url(url: str) -> str:
    """Hosts like Render and Heroku hand out postgres:// or postgresql:// URLs;
    SQLAlchemy needs the driver named to use psycopg 3."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = normalize_url(
    os.getenv("DATABASE_URL", "postgresql+psycopg://fuel:fuel@localhost:5432/fuel")
)


def make_engine(url: str):
    if url.startswith("sqlite"):
        # In-memory SQLite is used by the tests; StaticPool keeps one shared connection.
        return create_engine(
            url, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    return create_engine(url, pool_pre_ping=True)


engine = make_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
