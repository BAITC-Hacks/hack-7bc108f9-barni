import os
import subprocess
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.db import DATABASE_URL


@pytest.fixture(scope="session")
def engine():
    """A separate <db>_test database, recreated and migrated by Alembic once per run."""
    base = make_url(DATABASE_URL)
    test_url = base.set(database=f"{base.database}_test")
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{test_url.database}" WITH (FORCE)'))
            connection.execute(text(f'CREATE DATABASE "{test_url.database}"'))
    except Exception as error:  # noqa: BLE001
        pytest.skip(f"PostgreSQL is not reachable: {error}")
    finally:
        admin.dispose()
    url = test_url.render_as_string(hide_password=False)
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
    )
    engine = create_engine(url)
    yield engine
    engine.dispose()
