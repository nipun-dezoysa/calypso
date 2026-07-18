from collections import defaultdict
from collections.abc import Awaitable, Callable

from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from src.models.node_model import Node
from src.models.workflow_model import Workflow

NodeRunner = Callable[[Node, str], Awaitable[str]]


def latest_text(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        content = getattr(m, "content", None)
        if content:
            return str(content)
    return ""


def build_workflow_graph(workflow: Workflow, run_node: NodeRunner):
    nodes = {n.id: n for n in workflow.nodes}
    if not nodes:
        raise ValueError("this workflow has no nodes")

    start = next((n for n in workflow.nodes if n.is_start), None)
    if start is None:
        raise ValueError("this workflow has no start node")

    outgoing: dict[str, list[str]] = defaultdict(list)
    for e in workflow.edges:
        if e.source in nodes and e.target in nodes:
            outgoing[e.source].append(e.target)

    # Only include nodes reachable from the start node.
    reachable: set[str] = set()
    stack = [start.id]
    while stack:
        nid = stack.pop()
        if nid in reachable:
            continue
        reachable.add(nid)
        stack.extend(outgoing[nid])

    graph = StateGraph(MessagesState)

    def make_node_fn(node: Node):
        async def node_fn(state: MessagesState) -> dict:
            output = await run_node(node, latest_text(state["messages"]))
            return {"messages": [AIMessage(content=output)]}

        return node_fn

    for nid in reachable:
        graph.add_node(nid, make_node_fn(nodes[nid]))

    graph.add_edge(START, start.id)
    for src in reachable:
        targets = [t for t in outgoing[src] if t in reachable]
        if targets:
            for target in targets:
                graph.add_edge(src, target)
        else:
            graph.add_edge(src, END)  # leaf node -> finish

    return graph.compile()
