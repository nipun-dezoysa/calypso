import re
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Annotated

from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from src.models.condition_model import OPERATOR_ALWAYS, Condition
from src.models.edge_model import Edge
from src.models.node_model import NODE_TYPE_CONDITION, Node
from src.models.workflow_model import Workflow

# (node, question, handoff) -> output text
NodeRunner = Callable[[Node, str, str], Awaitable[str]]


def _last_write_wins(_current: str, incoming: str) -> str:
    return incoming


class WorkflowState(MessagesState):
    question: str
    handoff: Annotated[str, _last_write_wins]


def latest_text(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        content = getattr(m, "content", None)
        if content:
            return str(content)
    return ""


def branch_matches(branch: Condition, text: str) -> bool:
    operator = branch.operator
    if operator == OPERATOR_ALWAYS:
        return True

    value = branch.value or ""
    if operator == "regex":
        flags = 0 if branch.case_sensitive else re.IGNORECASE
        try:
            return re.search(value, text, flags) is not None
        except re.error:
            return False  # a branch that cannot compile simply never matches

    subject, needle = (text, value) if branch.case_sensitive else (text.lower(), value.lower())
    if operator == "contains":
        return needle in subject
    if operator == "not_contains":
        return needle not in subject
    if operator == "equals":
        return subject.strip() == needle.strip()
    if operator == "not_equals":
        return subject.strip() != needle.strip()
    if operator == "starts_with":
        return subject.lstrip().startswith(needle)
    if operator == "ends_with":
        return subject.rstrip().endswith(needle)
    return False


def build_workflow_graph(workflow: Workflow, run_node: NodeRunner):
    nodes = {n.id: n for n in workflow.nodes}
    if not nodes:
        raise ValueError("this workflow has no nodes")

    start = next((n for n in workflow.nodes if n.is_start), None)
    if start is None:
        raise ValueError("this workflow has no start node")

    outgoing: dict[str, list[Edge]] = defaultdict(list)
    for e in workflow.edges:
        if e.source in nodes and e.target in nodes:
            outgoing[e.source].append(e)

    # Branches per condition node, in evaluation order (first match wins).
    branches: dict[str, list[Condition]] = defaultdict(list)
    for c in sorted(workflow.conditions, key=lambda c: c.order_index):
        if c.n_id in nodes:
            branches[c.n_id].append(c)

    # Only include nodes reachable from the start node.
    reachable: set[str] = set()
    stack = [start.id]
    while stack:
        nid = stack.pop()
        if nid in reachable:
            continue
        reachable.add(nid)
        stack.extend(e.target for e in outgoing[nid])

    graph = StateGraph(WorkflowState)

    def make_node_fn(node: Node):
        async def node_fn(state: WorkflowState) -> dict:
            output = await run_node(node, state["question"], state.get("handoff", ""))
            return {"messages": [AIMessage(content=output)], "handoff": output}

        return node_fn

    async def condition_fn(_state: WorkflowState) -> dict:
        return {}  # a condition only routes; it does not change the conversation

    for nid in reachable:
        if nodes[nid].type == NODE_TYPE_CONDITION:
            graph.add_node(nid, condition_fn)
        else:
            graph.add_node(nid, make_node_fn(nodes[nid]))

    graph.add_edge(START, start.id)
    for src in reachable:
        targets = [e.target for e in outgoing[src] if e.target in reachable]
        if nodes[src].type == NODE_TYPE_CONDITION:
            _wire_condition(graph, src, branches[src], outgoing[src], reachable)
        elif targets:
            for target in targets:
                graph.add_edge(src, target)
        else:
            graph.add_edge(src, END)  # leaf node -> finish

    return graph.compile()


def _wire_condition(
    graph: StateGraph,
    node_id: str,
    node_branches: list[Condition],
    node_edges: list[Edge],
    reachable: set[str],
) -> None:
    routes: dict[str, list[str]] = defaultdict(list)
    for e in node_edges:
        if e.source_handle and e.target in reachable:
            routes[e.source_handle].append(e.target)

    destinations = {t for targets in routes.values() for t in targets}
    if not destinations:
        graph.add_edge(node_id, END)
        return

    def router(state: WorkflowState):
        # Branch on the upstream node's output; a condition placed at the entry
        # point has none, so it falls back to the question itself.
        text = state.get("handoff") or state.get("question", "")
        for branch in node_branches:
            if branch_matches(branch, text):
                return routes.get(branch.id) or END
        return END

    graph.add_conditional_edges(node_id, router, [*sorted(destinations), END])
