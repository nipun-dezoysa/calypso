import re
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field

from pydantic import ValidationError

from src.models.condition_model import (
    CONDITION_OPERATORS,
    OPERATOR_ALWAYS,
    VALUELESS_OPERATORS,
)
from src.models.node_model import NODE_TYPE_AGENT, NODE_TYPE_CONDITION, NODE_TYPES
from src.schemas.workflow_designer_schema import (
    DraftAgentNode,
    DraftCondition,
    DraftEdge,
    DraftNode,
    DraftWorkflow,
    ProposedWorkflow,
)
from src.schemas.workflow_schema import (
    AgentNodeInput,
    AgentNodeResponse,
    ConditionInput,
    ConditionResponse,
    EdgeInput,
    EdgeResponse,
    NodeInput,
    NodeResponse,
    validate_graph,
)

COLUMN_GAP = 300.0
ROW_GAP = 150.0
COLLISION_X = 240.0
COLLISION_Y = 100.0

DEFAULT_NAME = "Untitled Workflow"


@dataclass(frozen=True)
class Catalog:
    """The ids that exist. Anything the designer names outside these is scrubbed."""

    agent_ids: set[str] = field(default_factory=set)
    model_ids: set[str] = field(default_factory=set)
    collection_ids: set[str] = field(default_factory=set)
    server_ids: set[str] = field(default_factory=set)


class _Notes:
    """Repairs worth telling the user about, deduplicated and in order."""

    def __init__(self) -> None:
        self._seen: list[str] = []

    def add(self, note: str) -> None:
        if note not in self._seen:
            self._seen.append(note)

    def all(self) -> list[str]:
        return list(self._seen)


def repair_proposal(
    raw: dict,
    draft: DraftWorkflow,
    catalog: Catalog,
    fallback_model_id: str | None = None,
) -> tuple[ProposedWorkflow | None, list[str]]:
    """Normalise one proposed graph. Returns the graph and the notes, or
    (None, notes) when it could not be made valid."""
    notes = _Notes()

    nodes = _clean_nodes(_parse_each(raw.get("nodes"), DraftNode, notes, "nodes"), notes)
    if not nodes:
        notes.add("The designer's answer contained no usable nodes.")
        return None, notes.all()

    # Ids the designer reused from the canvas identify the same node; anything
    # else is new and gets a real id, whatever the designer called it.
    id_map = _remap_ids([n.id for n in nodes], {n.id for n in draft.nodes})
    for n in nodes:
        n.id = id_map[n.id]
    node_types = {n.id: n.type for n in nodes}

    conditions, branch_map = _clean_conditions(
        _parse_each(raw.get("conditions"), DraftCondition, notes, "branches"),
        id_map,
        node_types,
        draft,
        notes,
    )
    conditions = _ensure_branches(conditions, node_types, notes)

    agent_nodes = _clean_agent_nodes(
        _parse_each(raw.get("agent_nodes"), DraftAgentNode, notes, "agent configs"),
        id_map,
        node_types,
        draft,
        catalog,
        fallback_model_id,
        notes,
    )

    edges = _clean_edges(
        _parse_each(raw.get("edges"), DraftEdge, notes, "connections"),
        id_map,
        node_types,
        branch_map,
        conditions,
        notes,
    )

    nodes = _fix_start(nodes, edges, notes)

    positions = _place_nodes(
        nodes, edges, {n.id: (n.position_x, n.position_y) for n in draft.nodes}
    )
    for n in nodes:
        n.position_x, n.position_y = positions[n.id]

    name = str(raw.get("name") or "").strip() or draft.name.strip() or DEFAULT_NAME

    try:
        proposal = _to_proposal(name, nodes, edges, conditions, agent_nodes)
    except (ValueError, ValidationError) as exc:
        notes.add(f"The designer's workflow could not be used: {_first_message(exc)}")
        return None, notes.all()

    return proposal, notes.all()


# ── Parsing ───────────────────────────────────────────────────────────────


def _parse_each(raw, model, notes: _Notes, label: str):
    """Validate a list item by item, skipping the ones that do not fit. One
    malformed entry should cost that entry, not the whole proposal — but a
    dropped entry is always worth saying out loud, because losing one quietly
    shows up much later as a graph that mysteriously will not validate."""
    if not isinstance(raw, list):
        if raw is not None:
            notes.add(f"The designer's {label} were not a list and were ignored.")
        return []
    parsed = []
    for item in raw:
        if not isinstance(item, dict):
            notes.add(f"One of the {label} was not an object and was dropped.")
            continue
        try:
            parsed.append(model.model_validate(item))
        except ValidationError as exc:
            notes.add(f"One of the {label} was malformed and was dropped: {_first_message(exc)}")
    return parsed


def _remap_ids(proposed: list[str], existing: set[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for pid in proposed:
        if pid in mapping:
            continue
        mapping[pid] = pid if pid in existing else str(uuid.uuid4())
    return mapping


# ── Nodes ─────────────────────────────────────────────────────────────────


def _clean_nodes(nodes: list[DraftNode], notes: _Notes) -> list[DraftNode]:
    cleaned: list[DraftNode] = []
    seen: set[str] = set()
    for n in nodes:
        n.type = (n.type or "").strip().lower()
        if n.type not in NODE_TYPES:
            notes.add(f"A node had an unknown type ('{n.type}') and was made an agent node.")
            n.type = NODE_TYPE_AGENT
        if n.id in seen:
            notes.add("The same node id was used twice; the duplicate was dropped.")
            continue
        seen.add(n.id)
        cleaned.append(n)
    return cleaned


def _fix_start(nodes: list[DraftNode], edges: list[DraftEdge], notes: _Notes) -> list[DraftNode]:
    starts = [n for n in nodes if n.is_start]
    if len(starts) == 1:
        return nodes

    if len(starts) > 1:
        for n in starts[1:]:
            n.is_start = False
        notes.add("More than one node was marked as the start; only the first was kept.")
        return nodes

    # No start node: the one nothing points at is the obvious entry point.
    targets = {e.target for e in edges}
    entry = next((n for n in nodes if n.id not in targets), nodes[0])
    entry.is_start = True
    notes.add("No start node was marked, so the first node with nothing feeding it was used.")
    return nodes


# ── Conditions ────────────────────────────────────────────────────────────


def _clean_conditions(
    conditions: list[DraftCondition],
    id_map: dict[str, str],
    node_types: dict[str, str],
    draft: DraftWorkflow,
    notes: _Notes,
) -> tuple[list[DraftCondition], dict[str, str]]:
    """Returns the cleaned branches and the map from the ids the designer used
    to the real ones — the edges still have to resolve their `source_handle`
    through it."""
    branch_map = _remap_ids([c.id for c in conditions], {c.id for c in draft.conditions})
    cleaned: list[DraftCondition] = []
    seen: set[str] = set()

    for c in conditions:
        n_id = id_map.get(c.n_id)
        if n_id is None or node_types.get(n_id) != NODE_TYPE_CONDITION:
            notes.add("A branch pointed at something that is not a condition node and was dropped.")
            continue

        c.id = branch_map[c.id]
        if c.id in seen:
            continue
        seen.add(c.id)
        c.n_id = n_id
        c.label = (c.label or "").strip()[:100]

        c.operator = (c.operator or "").strip().lower()
        if c.operator not in CONDITION_OPERATORS:
            notes.add(f"A branch used a test that does not exist ('{c.operator}') and was made a catch-all.")
            c.operator = OPERATOR_ALWAYS

        if c.operator in VALUELESS_OPERATORS:
            c.value = None
        elif not (c.value or "").strip():
            notes.add("A branch had nothing to match against and was made a catch-all.")
            c.operator = OPERATOR_ALWAYS
            c.value = None
        elif c.operator == "regex" and not _compiles(c.value):
            notes.add(f"A branch's regular expression was invalid and was matched literally: {c.value}")
            c.operator = "contains"

        cleaned.append(c)

    return _order_branches(cleaned), branch_map


def _order_branches(conditions: list[DraftCondition]) -> list[DraftCondition]:
    """`order_index` decides which branch wins first, so renumber per node
    rather than trusting whatever the designer counted to. A catch-all placed
    before a real test would swallow it, so it goes last."""
    by_node: dict[str, list[DraftCondition]] = defaultdict(list)
    for c in sorted(conditions, key=lambda c: c.order_index):
        by_node[c.n_id].append(c)

    ordered: list[DraftCondition] = []
    for branches in by_node.values():
        branches.sort(key=lambda c: c.operator == OPERATOR_ALWAYS)
        for i, c in enumerate(branches):
            c.order_index = i
        ordered.extend(branches)
    return ordered


def _ensure_branches(
    conditions: list[DraftCondition], node_types: dict[str, str], notes: _Notes
) -> list[DraftCondition]:
    """A condition node with no branches routes nowhere and cannot be saved.
    One catch-all keeps the rest of the proposal usable."""
    have = {c.n_id for c in conditions}
    for node_id, node_type in node_types.items():
        if node_type != NODE_TYPE_CONDITION or node_id in have:
            continue
        conditions.append(
            DraftCondition(
                id=str(uuid.uuid4()),
                n_id=node_id,
                label="Anything",
                operator=OPERATOR_ALWAYS,
                value=None,
                order_index=0,
            )
        )
        notes.add("A condition node came back with no branches and was given a catch-all.")
    return conditions


def _compiles(pattern: str | None) -> bool:
    try:
        re.compile(pattern or "")
    except re.error:
        return False
    return True


# ── Agent nodes ───────────────────────────────────────────────────────────


def _clean_agent_nodes(
    agent_nodes: list[DraftAgentNode],
    id_map: dict[str, str],
    node_types: dict[str, str],
    draft: DraftWorkflow,
    catalog: Catalog,
    fallback_model_id: str | None,
    notes: _Notes,
) -> list[DraftAgentNode]:
    config_map = _remap_ids([a.id for a in agent_nodes], {a.id for a in draft.agent_nodes})
    draft_by_node = {a.n_id: a for a in draft.agent_nodes}
    cleaned: list[DraftAgentNode] = []
    configured: set[str] = set()
    used_ids: set[str] = set()

    for a in agent_nodes:
        n_id = id_map.get(a.n_id)
        if n_id is None or node_types.get(n_id) != NODE_TYPE_AGENT:
            notes.add(
                "An agent config pointed at something that is not an agent node and was dropped."
            )
            continue
        if n_id in configured:
            continue
        configured.add(n_id)

        a.id = _unique(config_map[a.id], used_ids)
        a.n_id = n_id
        _scrub_references(a, catalog, notes)
        _fill_gaps(a, draft_by_node.get(n_id), fallback_model_id, notes)
        cleaned.append(a)

    # A node the designer left out of its answer keeps whatever it had on the
    # canvas, so "add a step after triage" never silently guts triage.
    for node_id, node_type in node_types.items():
        if node_type != NODE_TYPE_AGENT or node_id in configured:
            continue
        previous = draft_by_node.get(node_id)
        if previous is None:
            continue
        carried = previous.model_copy(deep=True)
        carried.id = _unique(carried.id, used_ids)
        _scrub_references(carried, catalog, notes)
        _fill_gaps(carried, previous, fallback_model_id, notes)
        cleaned.append(carried)
        configured.add(node_id)
        notes.add(f"'{carried.name or node_id}' was left out of the answer and kept as it was.")

    return cleaned


def _unique(candidate: str, used: set[str]) -> str:
    """Two configs sharing an id fails validation, and the fix is free."""
    while candidate in used:
        candidate = str(uuid.uuid4())
    used.add(candidate)
    return candidate


def _scrub_references(a: DraftAgentNode, catalog: Catalog, notes: _Notes) -> None:
    """Drop every id that does not exist. An invented model id passes graph
    validation and only blows up on save, which is far too late to be useful."""
    label = a.name.strip() or "A node"

    if a.agent_id and a.agent_id not in catalog.agent_ids:
        notes.add(f"{label} named a base agent that does not exist; it was cleared.")
        a.agent_id = None
    if a.llm_model_id and a.llm_model_id not in catalog.model_ids:
        notes.add(f"{label} named a model that does not exist; it was cleared.")
        a.llm_model_id = None

    kept = [c for c in dict.fromkeys(a.collection_ids) if c in catalog.collection_ids]
    if len(kept) != len(a.collection_ids):
        notes.add(f"{label} referenced a knowledgebase that does not exist; it was dropped.")
    a.collection_ids = kept

    servers = [s for s in dict.fromkeys(a.mcp_server_ids) if s in catalog.server_ids]
    if len(servers) != len(a.mcp_server_ids):
        notes.add(f"{label} referenced an MCP server that does not exist; it was dropped.")
    a.mcp_server_ids = servers

    if a.creativity is not None:
        a.creativity = max(0, min(100, a.creativity))


def _fill_gaps(
    a: DraftAgentNode,
    previous: DraftAgentNode | None,
    fallback_model_id: str | None,
    notes: _Notes,
) -> None:
    """A node needs a model and instructions, or a base agent to take them from.
    Whatever the node already had on the canvas is the best source for either."""
    a.name = (a.name or "").strip()[:100]
    a.node_instructions = (a.node_instructions or "").strip()
    a.output_instructions = (a.output_instructions or "").strip()

    if not a.agent_id and not a.llm_model_id and previous is not None:
        a.agent_id = previous.agent_id
        a.llm_model_id = previous.llm_model_id

    if not a.agent_id and not a.llm_model_id and fallback_model_id:
        a.llm_model_id = fallback_model_id
        notes.add(
            f"'{a.name or a.n_id}' came back without a model, so the designer's own model "
            "was filled in — change it on the node if that is not what you want."
        )

    if not a.agent_id and not a.node_instructions and previous is not None:
        a.node_instructions = previous.node_instructions


# ── Edges ─────────────────────────────────────────────────────────────────


def _clean_edges(
    edges: list[DraftEdge],
    id_map: dict[str, str],
    node_types: dict[str, str],
    branch_map: dict[str, str],
    conditions: list[DraftCondition],
    notes: _Notes,
) -> list[DraftEdge]:
    branches_by_node: dict[str, list[DraftCondition]] = defaultdict(list)
    for c in conditions:
        branches_by_node[c.n_id].append(c)

    cleaned: list[DraftEdge] = []
    seen: set[tuple[str, str | None, str]] = set()
    direction: dict[frozenset[str], str] = {}

    for e in edges:
        source = id_map.get(e.source)
        target = id_map.get(e.target)
        if source is None or target is None:
            notes.add("A connection pointed at a node that is not in the workflow and was dropped.")
            continue
        if source == target:
            notes.add("A node was connected to itself; that connection was dropped.")
            continue

        if node_types.get(source) == NODE_TYPE_CONDITION:
            handle = _resolve_handle(e.source_handle, branch_map, branches_by_node[source], notes)
            if handle is None:
                continue
            e.source_handle = handle
        else:
            e.source_handle = None

        key = (source, e.source_handle, target)
        if key in seen:
            continue
        seen.add(key)

        pair = frozenset((source, target))
        if direction.setdefault(pair, source) != source:
            notes.add("Two nodes were wired together both ways; the second connection was dropped.")
            continue

        e.source, e.target = source, target
        cleaned.append(e)

    return cleaned


def _resolve_handle(
    handle: str | None,
    branch_map: dict[str, str],
    branches: list[DraftCondition],
    notes: _Notes,
) -> str | None:
    """Work out which branch an edge out of a condition node leaves from."""
    if handle:
        resolved = branch_map.get(handle, handle)
        if any(b.id == resolved for b in branches):
            return resolved
    if len(branches) == 1:
        return branches[0].id  # no ambiguity: there is only one way out
    notes.add(
        "A connection out of a condition node did not say which branch it leaves from "
        "and was dropped."
    )
    return None


# ── Layout ────────────────────────────────────────────────────────────────


def _place_nodes(
    nodes: list[DraftNode],
    edges: list[DraftEdge],
    existing: dict[str, tuple[float, float]],
) -> dict[str, tuple[float, float]]:
    """Leave every node the user already positioned exactly where it is, and lay
    the new ones out in columns around them."""
    laid_out = _layered_layout(nodes, edges)

    placed: list[tuple[float, float]] = []
    result: dict[str, tuple[float, float]] = {}

    for n in nodes:
        if n.id in existing:
            result[n.id] = existing[n.id]
            placed.append(existing[n.id])

    for n in nodes:
        if n.id in result:
            continue
        x, y = laid_out[n.id]
        while any(abs(x - px) < COLLISION_X and abs(y - py) < COLLISION_Y for px, py in placed):
            y += ROW_GAP
        result[n.id] = (x, y)
        placed.append((x, y))

    return result


def _layered_layout(
    nodes: list[DraftNode], edges: list[DraftEdge]
) -> dict[str, tuple[float, float]]:
    """One column per hop from the start node, stacked top to bottom."""
    outgoing: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        outgoing[e.source].append(e.target)

    start = next((n.id for n in nodes if n.is_start), nodes[0].id)
    depth: dict[str, int] = {start: 0}
    queue = deque([start])
    while queue:
        current = queue.popleft()
        for target in outgoing[current]:
            if target not in depth:
                depth[target] = depth[current] + 1
                queue.append(target)

    # Anything the start node cannot reach goes in a column past the rest.
    orphan_column = max(depth.values(), default=-1) + 1
    for n in nodes:
        depth.setdefault(n.id, orphan_column)

    rows: dict[int, int] = defaultdict(int)
    positions: dict[str, tuple[float, float]] = {}
    for n in nodes:
        column = depth[n.id]
        positions[n.id] = (column * COLUMN_GAP, rows[column] * ROW_GAP)
        rows[column] += 1
    return positions


# ── The final gate ────────────────────────────────────────────────────────


def _to_proposal(
    name: str,
    nodes: list[DraftNode],
    edges: list[DraftEdge],
    conditions: list[DraftCondition],
    agent_nodes: list[DraftAgentNode],
) -> ProposedWorkflow:
    """Put the repaired graph through the strict save-time schema. Whatever
    comes out of here is something the client can PUT straight back."""
    strict_nodes = [
        NodeInput(
            id=n.id,
            type=n.type,
            is_start=n.is_start,
            position_x=n.position_x,
            position_y=n.position_y,
        )
        for n in nodes
    ]
    strict_edges = [
        EdgeInput(source=e.source, target=e.target, source_handle=e.source_handle) for e in edges
    ]
    strict_conditions = [
        ConditionInput(
            id=c.id,
            n_id=c.n_id,
            label=c.label,
            operator=c.operator,
            value=c.value,
            case_sensitive=c.case_sensitive,
            order_index=c.order_index,
        )
        for c in conditions
    ]
    strict_agents = [
        AgentNodeInput(
            id=a.id,
            n_id=a.n_id,
            name=a.name,
            agent_id=a.agent_id,
            llm_model_id=a.llm_model_id,
            node_instructions=a.node_instructions,
            output_instructions=a.output_instructions,
            creativity=a.creativity,
            markdown_enabled=a.markdown_enabled,
            collection_ids=a.collection_ids,
            mcp_server_ids=a.mcp_server_ids,
        )
        for a in agent_nodes
    ]

    validate_graph(strict_nodes, strict_edges, strict_conditions, strict_agents)

    return ProposedWorkflow(
        name=name,
        nodes=[
            NodeResponse(
                id=n.id,
                type=n.type,
                i_id=n.i_id,
                is_start=n.is_start,
                position_x=n.position_x,
                position_y=n.position_y,
            )
            for n in strict_nodes
        ],
        edges=[
            EdgeResponse(
                id=str(uuid.uuid4()),
                source=e.source,
                target=e.target,
                source_handle=e.source_handle,
            )
            for e in strict_edges
        ],
        conditions=[
            ConditionResponse(
                id=c.id,
                n_id=c.n_id,
                label=c.label,
                operator=c.operator,
                value=c.value,
                case_sensitive=c.case_sensitive,
                order_index=c.order_index,
            )
            for c in strict_conditions
        ],
        agent_nodes=[
            AgentNodeResponse(
                id=a.id,
                n_id=a.n_id,
                name=a.name,
                agent_id=a.agent_id,
                llm_model_id=a.llm_model_id,
                node_instructions=a.node_instructions,
                output_instructions=a.output_instructions,
                creativity=a.creativity,
                markdown_enabled=a.markdown_enabled,
                collection_ids=a.collection_ids,
                mcp_server_ids=a.mcp_server_ids,
            )
            for a in strict_agents
        ],
    )


def _first_message(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        errors = exc.errors()
        if errors:
            return str(errors[0].get("msg", "")).replace("Value error, ", "")
    return str(exc)
