import json

from langchain_core.tools import StructuredTool

from src.models.graph_db_model import GraphDatabase
from src.services import graph_client
from src.services.graph_client import GraphConnection, GraphError

SCHEMA_TOOL_PREFIX = "graph_schema_"
QUERY_TOOL_PREFIX = "graph_query_"

NO_ROWS = "The query ran and matched nothing."


def build_tools(graph_dbs: list[GraphDatabase]) -> list[StructuredTool]:
    """One schema tool and one query tool per enabled database.

    Names are derived from the database name; a collision after sanitising
    (`my db` and `my-db` both slugify to `my_db`) falls back to the id."""
    tools: list[StructuredTool] = []
    used: set[str] = set()

    for graph_db in graph_dbs:
        if not graph_db.enabled:
            continue

        suffix = graph_db.tool_suffix
        if suffix in used:
            suffix = f"{suffix}_{graph_db.id.replace('-', '')[:6]}"
        used.add(suffix)

        # Read the row's fields now: the tools outlive the ORM session.
        key = graph_db.id
        label = graph_db.name
        about = (graph_db.description or "").strip()
        conn = GraphConnection.from_dict(graph_db.to_connection())

        tools.append(_schema_tool(key, label, about, conn, suffix))
        tools.append(_query_tool(key, label, about, conn, suffix))

    return tools


def _schema_tool(
    key: str, label: str, about: str, conn: GraphConnection, suffix: str
) -> StructuredTool:
    async def run() -> str:
        try:
            schema = await graph_client.fetch_schema(key, conn)
        except GraphError as exc:
            return f"Could not read the schema of '{label}': {exc}"
        return _format_schema(label, schema)

    detail = f" {about}" if about else ""
    return StructuredTool.from_function(
        coroutine=run,
        name=f"{SCHEMA_TOOL_PREFIX}{suffix}",
        description=(
            f"Describe the structure of the '{label}' graph database:{detail} "
            "its node labels and their properties, its relationship types, and "
            "the patterns that connect them. Call this before writing a Cypher "
            f"query for '{label}', so the query uses labels and properties that "
            "actually exist."
        ),
        args_schema={"type": "object", "properties": {}, "required": []},
    )


def _query_tool(
    key: str, label: str, about: str, conn: GraphConnection, suffix: str
) -> StructuredTool:
    async def run(cypher: str) -> str:
        statement = (cypher or "").strip()
        if not statement:
            return "No query was given. Pass a Cypher statement in `cypher`."
        try:
            rows = await graph_client.run_query(key, conn, statement)
        except GraphError as exc:
            return (
                f"The query failed against '{label}': {exc}\n"
                f"Check the schema with {SCHEMA_TOOL_PREFIX}{suffix} and try again."
            )
        if not rows:
            return NO_ROWS
        return _format_rows(rows, conn.max_rows)

    access = (
        "The database is read-only, so only MATCH/RETURN-style reads succeed; "
        "CREATE, MERGE, SET and DELETE are rejected by the server."
        if conn.read_only
        else "Writes are permitted, so change data only when the user asked for it."
    )
    detail = f" {about}" if about else ""
    return StructuredTool.from_function(
        coroutine=run,
        name=f"{QUERY_TOOL_PREFIX}{suffix}",
        description=(
            f"Run one Cypher statement against the '{label}' graph database and "
            f"get the rows back as JSON.{detail} {access} At most "
            f"{conn.max_rows} rows are returned, so add your own LIMIT for "
            "anything that could match widely. Pass the statement alone, with "
            "no trailing semicolon and no explanation around it."
        ),
        args_schema={
            "type": "object",
            "properties": {
                "cypher": {
                    "type": "string",
                    "description": (
                        "The Cypher statement to run, e.g. "
                        "MATCH (p:Person)-[:ACTED_IN]->(m:Movie) "
                        "RETURN p.name, m.title LIMIT 10"
                    ),
                }
            },
            "required": ["cypher"],
        },
    )


def _format_schema(label: str, schema: dict) -> str:
    nodes = schema.get("nodes") or []
    relationships = schema.get("relationships") or []
    patterns = schema.get("patterns") or []

    if not nodes and not relationships:
        return f"The '{label}' graph database is empty, or its schema is not readable."

    lines = [f"Schema of the '{label}' graph database.", "", "Node labels:"]
    if nodes:
        for node in nodes:
            props = ", ".join(node.get("properties") or []) or "no properties"
            lines.append(f"  (:{node['label']}) — {props}")
    else:
        lines.append("  none")

    lines += ["", "Relationship types:"]
    if relationships:
        for rel in relationships:
            props = ", ".join(rel.get("properties") or []) or "no properties"
            lines.append(f"  [:{rel['type']}] — {props}")
    else:
        lines.append("  none")

    if patterns:
        lines += ["", "How they connect:"]
        lines += [f"  {pattern}" for pattern in patterns]

    return "\n".join(lines)


def _format_rows(rows: list[dict], max_rows: int) -> str:
    body = json.dumps(rows, indent=2, default=str, ensure_ascii=False)
    header = f"{len(rows)} row{'' if len(rows) == 1 else 's'}"
    if len(rows) >= max_rows:
        header += f" (capped at {max_rows}; there may be more)"
    return f"{header}:\n{body}"
