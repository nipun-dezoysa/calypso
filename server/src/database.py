import os

from sqlalchemy import Connection, MetaData, event, inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Overridable so a container can put the file on a mounted volume.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./calypso.db")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"timeout": 30},
)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    """WAL lets readers and the writer coexist; busy_timeout makes a second
    writer wait for the lock instead of failing with 'database is locked'."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)


# Nullable columns added to tables that shipped without them. `create_all` only
# creates missing *tables*, so an existing database needs these added by hand.
_ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "edges": {"source_handle": "VARCHAR(36)"},
    "llm_models": {"context_tokens": "INTEGER"},
}


def _add_missing_columns(conn: Connection) -> None:
    inspector = inspect(conn)
    tables = set(inspector.get_table_names())
    for table, columns in _ADDED_COLUMNS.items():
        if table not in tables:
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl in columns.items():
            if name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def _backfill_workflow_agents(conn: Connection) -> None:
    conn.exec_driver_sql(
        """
        INSERT INTO workflow_agents (id, w_id, n_id, name, agent_id,
                                     node_instructions, output_instructions)
        SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2)))
                 || '-4' || substr(lower(hex(randomblob(2))), 2)
                 || '-a' || substr(lower(hex(randomblob(2))), 2)
                 || '-' || lower(hex(randomblob(6))),
               n.w_id, n.id, COALESCE(a.name, ''), n.i_id, '', ''
        FROM nodes n
        LEFT JOIN agents a ON a.id = n.i_id
        WHERE n.type = 'agent'
          AND NOT EXISTS (SELECT 1 FROM workflow_agents wa WHERE wa.n_id = n.id)
        """
    )


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
        await conn.run_sync(_backfill_workflow_agents)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
