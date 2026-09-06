import asyncio
from dataclasses import dataclass
from typing import Any

from neo4j import READ_ACCESS, WRITE_ACCESS, AsyncGraphDatabase
from neo4j.graph import Node, Path, Relationship

DEFAULT_CONNECT_TIMEOUT = 10.0
MAX_RETRY_SECONDS = 3.0
MAX_STRING_CHARS = 500
SCHEMA_ROW_LIMIT = 2000


@dataclass(frozen=True)
class GraphConnection:
    """Flattened connection details, detached from the ORM row."""

    uri: str
    username: str | None = None
    password: str | None = None
    database: str | None = None
    read_only: bool = True
    timeout: int = 15
    max_rows: int = 50

    @classmethod
    def from_dict(cls, data: dict) -> "GraphConnection":
        return cls(
            uri=data["uri"],
            username=data.get("username"),
            password=data.get("password"),
            database=data.get("database"),
            read_only=bool(data.get("read_only", True)),
            timeout=int(data.get("timeout", 15)),
            max_rows=int(data.get("max_rows", 50)),
        )

    @property
    def auth(self) -> tuple[str, str] | None:
        if not self.username:
            return None
        return (self.username, self.password or "")

    @property
    def fingerprint(self) -> tuple:
        """Everything that, when changed, needs a fresh driver."""
        return (self.uri, self.username, self.password, self.database)


class GraphError(Exception):
    """A connection or query failure worth showing to the user or the model."""


# ── driver cache ──────────────────────────────────────────────────────────

_drivers: dict[str, tuple[tuple, Any]] = {}
_lock = asyncio.Lock()


async def _get_driver(key: str, conn: GraphConnection):
    async with _lock:
        cached = _drivers.get(key)
        if cached is not None:
            fingerprint, driver = cached
            if fingerprint == conn.fingerprint:
                return driver
            # Credentials or target changed; the old pool is useless now.
            await _close(driver)
            del _drivers[key]

        driver = AsyncGraphDatabase.driver(
            conn.uri,
            auth=conn.auth,
            connection_timeout=DEFAULT_CONNECT_TIMEOUT,
            connection_acquisition_timeout=DEFAULT_CONNECT_TIMEOUT,
            max_transaction_retry_time=MAX_RETRY_SECONDS,
        )
        _drivers[key] = (conn.fingerprint, driver)
        return driver


async def _close(driver) -> None:
    try:
        await driver.close()
    except Exception:  # noqa: BLE001 - closing a dead pool must not raise
        pass


async def evict(key: str) -> None:
    """Drop the cached driver for a database, after an edit or a delete."""
    async with _lock:
        cached = _drivers.pop(key, None)
    if cached is not None:
        await _close(cached[1])


async def close_all() -> None:
    async with _lock:
        drivers = [d for _, d in _drivers.values()]
        _drivers.clear()
    for driver in drivers:
        await _close(driver)


# ── queries ───────────────────────────────────────────────────────────────


async def _run(
    key: str,
    conn: GraphConnection,
    cypher: str,
    params: dict | None = None,
    *,
    force_read: bool = False,
    max_rows: int | None = None,
) -> list[dict]:
    """Run one statement in an explicit transaction.

    Explicit rather than managed, for two reasons: it takes a server-side
    `timeout`, and it does not retry, so a database that is down fails in
    seconds instead of after the driver's retry window."""
    driver = await _get_driver(key, conn)
    read = force_read or conn.read_only
    access = READ_ACCESS if read else WRITE_ACCESS
    limit = conn.max_rows if max_rows is None else max_rows

    async def work() -> list[dict]:
        async with driver.session(
            database=conn.database, default_access_mode=access
        ) as session:
            # The context manager rolls the transaction back if anything below
            # raises, so a failed query never leaves one open.
            async with await session.begin_transaction(timeout=conn.timeout) as tx:
                result = await tx.run(cypher, params or {})
                rows: list[dict] = []
                async for record in result:
                    rows.append(
                        {k: _jsonable(v) for k, v in zip(record.keys(), record.values())}
                    )
                    if len(rows) >= limit:
                        break
                # Reads commit nothing; this just releases the transaction.
                await tx.commit()
                return rows

    # The server-side timeout is the real guard; wait_for keeps a server that
    # accepts the connection and then goes silent from hanging the chat turn.
    return await asyncio.wait_for(work(), timeout=conn.timeout + 5)


async def verify(key: str, conn: GraphConnection) -> None:
    """Raise GraphError unless the database is reachable and accepts auth."""
    try:
        driver = await _get_driver(key, conn)
        await asyncio.wait_for(
            driver.verify_connectivity(), timeout=DEFAULT_CONNECT_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise GraphError(f"Timed out connecting to {conn.uri}") from None
    except Exception as exc:  # noqa: BLE001 - surfaced to the user as text
        raise GraphError(_clean(exc)) from exc


async def fetch_schema(key: str, conn: GraphConnection) -> dict:
    """Node labels with their properties, relationship types, and the
    (from)-[rel]->(to) patterns that actually occur.

    Introspection procedures vary by Neo4j version and by what the user's role
    may call, so each part degrades on its own rather than failing the whole
    call."""
    labels = await _labels(key, conn)
    rel_types = await _rel_types(key, conn)
    node_props = await _node_properties(key, conn)
    rel_props = await _rel_properties(key, conn)
    patterns = await _patterns(key, conn)

    nodes = [
        {"label": label, "properties": node_props.get(label, [])} for label in labels
    ]
    relationships = [
        {"type": rel_type, "properties": rel_props.get(rel_type, [])}
        for rel_type in rel_types
    ]
    return {"nodes": nodes, "relationships": relationships, "patterns": patterns}


async def _labels(key: str, conn: GraphConnection) -> list[str]:
    try:
        rows = await _run(
            key,
            conn,
            "CALL db.labels() YIELD label RETURN label",
            force_read=True,
            max_rows=SCHEMA_ROW_LIMIT,
        )
    except Exception:  # noqa: BLE001
        return []
    return sorted(str(r["label"]) for r in rows)


async def _rel_types(key: str, conn: GraphConnection) -> list[str]:
    try:
        rows = await _run(
            key,
            conn,
            "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType",
            force_read=True,
            max_rows=SCHEMA_ROW_LIMIT,
        )
    except Exception:  # noqa: BLE001
        return []
    return sorted(str(r["relationshipType"]) for r in rows)


async def _node_properties(key: str, conn: GraphConnection) -> dict[str, list[str]]:
    """Property names per label, from db.schema.nodeTypeProperties (Neo4j 4+)."""
    try:
        rows = await _run(
            key,
            conn,
            """
            CALL db.schema.nodeTypeProperties()
            YIELD nodeLabels, propertyName
            RETURN nodeLabels, propertyName
            """,
            force_read=True,
            max_rows=SCHEMA_ROW_LIMIT,
        )
    except Exception:  # noqa: BLE001
        return {}

    out: dict[str, set[str]] = {}
    for row in rows:
        prop = row.get("propertyName")
        if not prop:
            continue
        for label in row.get("nodeLabels") or []:
            out.setdefault(str(label), set()).add(str(prop))
    return {label: sorted(props) for label, props in out.items()}


async def _rel_properties(key: str, conn: GraphConnection) -> dict[str, list[str]]:
    try:
        rows = await _run(
            key,
            conn,
            """
            CALL db.schema.relTypeProperties()
            YIELD relType, propertyName
            RETURN relType, propertyName
            """,
            force_read=True,
            max_rows=SCHEMA_ROW_LIMIT,
        )
    except Exception:  # noqa: BLE001
        return {}

    out: dict[str, set[str]] = {}
    for row in rows:
        prop = row.get("propertyName")
        if not prop:
            continue
        # relType comes back as ":`KNOWS`"; the bare name is what a query uses.
        rel_type = str(row.get("relType") or "").strip(":`")
        if rel_type:
            out.setdefault(rel_type, set()).add(str(prop))
    return {rel_type: sorted(props) for rel_type, props in out.items()}


async def _patterns(key: str, conn: GraphConnection) -> list[str]:
    """Which labels connect to which, as `(:A)-[:REL]->(:B)` strings.

    db.schema.visualization samples the store rather than scanning it, so this
    stays cheap on a large graph. It returns one row of virtual nodes and
    relationships, the latter referring to the former by element id."""
    try:
        rows = await _run(
            key,
            conn,
            "CALL db.schema.visualization()",
            force_read=True,
            max_rows=SCHEMA_ROW_LIMIT,
        )
    except Exception:  # noqa: BLE001
        return []

    patterns: set[str] = set()
    for row in rows:
        labels_by_id = {
            node["_id"]: _node_label(node)
            for node in row.get("nodes") or []
            if isinstance(node, dict) and node.get("_id")
        }
        for rel in row.get("relationships") or []:
            if not isinstance(rel, dict):
                continue
            rel_type = rel.get("_type")
            start = labels_by_id.get(rel.get("_start"))
            end = labels_by_id.get(rel.get("_end"))
            if rel_type and start and end:
                patterns.add(f"(:{start})-[:{rel_type}]->(:{end})")
    return sorted(patterns)


def _node_label(node: dict) -> str | None:
    """The label of a virtual node from db.schema.visualization, which carries
    it either as a real label or as a `name` property."""
    labels = node.get("_labels") or []
    if labels:
        return str(labels[0])
    name = node.get("name")
    return str(name) if name else None


async def run_query(
    key: str,
    conn: GraphConnection,
    cypher: str,
    params: dict | None = None,
) -> list[dict]:
    """Run one Cypher statement and return at most `max_rows` rows.

    When the database is registered read-only the statement runs in a read
    transaction, so Neo4j itself rejects any write clause."""
    try:
        return await _run(key, conn, cypher, params)
    except asyncio.TimeoutError:
        raise GraphError(f"Query timed out after {conn.timeout}s") from None
    except Exception as exc:  # noqa: BLE001 - handed back to the model as text
        raise GraphError(_clean(exc)) from exc


# ── value conversion ──────────────────────────────────────────────────────


def _jsonable(value: Any) -> Any:
    """Turn driver types into something json.dumps and an LLM can both read."""
    if isinstance(value, Node):
        return {
            "_id": value.element_id,
            "_labels": sorted(value.labels),
            **{k: _jsonable(v) for k, v in value.items()},
        }
    if isinstance(value, Relationship):
        return {
            "_id": value.element_id,
            "_type": value.type,
            "_start": value.start_node.element_id if value.start_node else None,
            "_end": value.end_node.element_id if value.end_node else None,
            **{k: _jsonable(v) for k, v in value.items()},
        }
    if isinstance(value, Path):
        return {
            "nodes": [_jsonable(n) for n in value.nodes],
            "relationships": [_jsonable(r) for r in value.relationships],
        }
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_jsonable(v) for v in value]
    if isinstance(value, str):
        return value if len(value) <= MAX_STRING_CHARS else value[:MAX_STRING_CHARS] + "…"
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    # Temporal and spatial types have useful reprs; strings keep them readable.
    return str(value)


def _clean(exc: Exception) -> str:
    message = getattr(exc, "message", None) or str(exc)
    return str(message)[:1000]
