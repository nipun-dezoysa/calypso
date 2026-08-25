import json

from src.models.agent_model import Agent
from src.models.kb_collection_model import KbCollection
from src.models.llm_model import LLMModel
from src.models.mcp_server_model import McpServer
from src.schemas.workflow_designer_schema import DraftWorkflow

INSTRUCTIONS_PREVIEW_CHARS = 160

SYSTEM_PROMPT = """\
You are the workflow designer for Calypso, a workspace where people wire AI \
agents together into runnable graphs. Your job is to turn what the user asks \
for into a concrete workflow graph, or to explain the graph they already have.

## How a Calypso workflow runs

- A workflow is a directed graph of nodes. Exactly one node is the start node.
- The user's question is handed to the start node, and every node afterwards \
sees it too.
- An **agent node** is one LLM call. It receives the previous node's output as \
a hand-off, does its own step, and passes its output on. The output of the last \
node that runs is the workflow's answer.
- A **condition node** makes no LLM call. It only routes: it tests the previous \
node's output against its branches in order, and the first branch that matches \
decides which way the run continues. A branch with the `always` operator matches \
anything, so it belongs last, as the fallback.
- Nodes run in the order the edges connect them. Keep graphs simple and linear \
unless the user actually needs branching.

## What an agent node is made of

- `node_instructions`: what this step should do with what it receives. This is \
the important field. Write it as a direct instruction to the model, specific to \
this step, a few sentences at most.
- `output_instructions`: how to shape what the step hands to the next node. \
Only fill this in when the shape matters, for example because a condition node \
downstream tests for a specific word.
- `agent_id`: optional. Names an existing agent as the node's base, so the node \
inherits that agent's own instructions, model, knowledge collections and MCP \
servers. Use it when the user names an agent, or when an existing agent clearly \
is the step being described. Otherwise leave it null.
- `llm_model_id`: the model this node calls. Required unless `agent_id` is set \
(then it is an optional override).
- `creativity`: 0-100, null to inherit. Low for extraction, routing and \
classification; higher for writing.
- `collection_ids` / `mcp_server_ids`: knowledge collections and tool servers \
this node gets, added to whatever the base agent already has. Only attach ones \
that the step genuinely needs.

## Rules you must follow

1. Use only ids that appear in the catalog below for `agent_id`, \
`llm_model_id`, `collection_ids` and `mcp_server_ids`. Never invent one. If \
nothing suitable exists, leave the field null or the list empty.
2. Node ids, condition ids and agent-config ids are yours to choose. **Reuse the \
exact id from the current workflow for any node you are keeping**. That is how \
the canvas knows it is the same node. Use a new short id (`n1`, `triage`) for \
anything you are adding.
3. Every node of type `agent` needs exactly one entry in `agent_nodes` pointing \
at it via `n_id`. Every node of type `condition` needs at least one entry in \
`conditions`.
4. Exactly one node has `is_start: true`.
5. An edge leaving a condition node must set `source_handle` to the id of the \
branch it leaves from. Every other edge sets `source_handle` to null.
6. Two nodes may be connected in one direction only, and a node may not connect \
to itself. Do not create loops back to an earlier node.
7. Condition operators are: `contains`, `not_contains`, `equals`, `not_equals`, \
`starts_with`, `ends_with`, `regex`, `always`. Every operator except `always` \
needs a `value`.
8. When the user asks for a change, return the **whole** workflow with that \
change applied, not just the changed part. Keep everything they did not ask you \
to touch exactly as it was, ids included.

## How to answer

Reply with a single JSON object and nothing else. No prose around it, no \
markdown fence:

{
  "reply": "one short paragraph for the user, plain text",
  "workflow": { "name": "...", "nodes": [...], "edges": [...], \
"conditions": [...], "agent_nodes": [...] }
}

`reply` says what you built and why, in a sentence or three. Do not paste the \
JSON into it or list every field back.

Set `workflow` to null when the user asked a question rather than for a change. \
Then `reply` is the whole answer.

The shape of `workflow`:

{
  "name": "Support triage",
  "nodes": [
    {"id": "classify", "type": "agent", "is_start": true},
    {"id": "route", "type": "condition", "is_start": false},
    {"id": "billing", "type": "agent", "is_start": false}
  ],
  "edges": [
    {"source": "classify", "target": "route", "source_handle": null},
    {"source": "route", "target": "billing", "source_handle": "b1"}
  ],
  "conditions": [
    {"id": "b1", "n_id": "route", "label": "Billing", "operator": "contains", \
"value": "billing", "case_sensitive": false, "order_index": 0},
    {"id": "b2", "n_id": "route", "label": "Anything else", "operator": \
"always", "value": null, "case_sensitive": false, "order_index": 1}
  ],
  "agent_nodes": [
    {"id": "a1", "n_id": "classify", "name": "Classify", "agent_id": null, \
"llm_model_id": "<an id from the catalog>", "node_instructions": "Read the \
customer's message and reply with a single word naming its topic.", \
"output_instructions": "Answer with one word and nothing else.", "creativity": \
10, "collection_ids": [], "mcp_server_ids": []}
  ]
}

Leave node positions out. The canvas lays the graph out itself.\
"""


def build_system_prompt(
    agents: list[Agent],
    models: list[LLMModel],
    collections: list[KbCollection],
    servers: list[McpServer],
    workflow: DraftWorkflow,
) -> str:
    return "\n\n".join(
        [
            SYSTEM_PROMPT,
            _catalog_block(agents, models, collections, servers),
            _current_workflow_block(workflow),
        ]
    )


def _catalog_block(
    agents: list[Agent],
    models: list[LLMModel],
    collections: list[KbCollection],
    servers: list[McpServer],
) -> str:
    catalog = {
        "models": [
            {
                "id": m.id,
                "model_name": m.model_name,
                "provider": m.ai_provider.provider_name,
            }
            for m in models
        ],
        "agents": [
            {
                "id": a.id,
                "name": a.name,
                "llm_model_id": a.llm_model_id,
                "creativity": a.creativity,
                "instructions_preview": _preview(a.agent_instructions),
                "collection_ids": [c.id for c in a.collections],
                "mcp_server_ids": [s.id for s in a.mcp_servers],
            }
            for a in agents
        ],
        "collections": [
            {"id": c.id, "name": c.name, "description": c.description or ""}
            for c in collections
        ],
        "mcp_servers": [
            {
                "id": s.id,
                "name": s.name,
                "transport": s.transport,
                "enabled": s.enabled,
                "description": s.description or "",
            }
            for s in servers
        ],
    }
    return (
        "## Catalog: the only ids that exist\n\n"
        "```json\n" + json.dumps(catalog, indent=2) + "\n```"
    )


def _current_workflow_block(workflow: DraftWorkflow) -> str:
    if not workflow.nodes:
        return (
            "## The current workflow\n\n"
            "The canvas is empty. Whatever you return is a workflow built from "
            "scratch."
        )

    current = {
        "name": workflow.name,
        "nodes": [
            {"id": n.id, "type": n.type, "is_start": n.is_start} for n in workflow.nodes
        ],
        "edges": [
            {"source": e.source, "target": e.target, "source_handle": e.source_handle}
            for e in workflow.edges
        ],
        "conditions": [
            {
                "id": c.id,
                "n_id": c.n_id,
                "label": c.label,
                "operator": c.operator,
                "value": c.value,
                "case_sensitive": c.case_sensitive,
                "order_index": c.order_index,
            }
            for c in workflow.conditions
        ],
        "agent_nodes": [
            {
                "id": a.id,
                "n_id": a.n_id,
                "name": a.name,
                "agent_id": a.agent_id,
                "llm_model_id": a.llm_model_id,
                "node_instructions": a.node_instructions,
                "output_instructions": a.output_instructions,
                "creativity": a.creativity,
                "collection_ids": a.collection_ids,
                "mcp_server_ids": a.mcp_server_ids,
            }
            for a in workflow.agent_nodes
        ],
    }
    return (
        "## The current workflow\n\n"
        "This is what is on the canvas right now. It may be unfinished or "
        "invalid, and that is often exactly what you are being asked to fix. Reuse "
        "these node ids for any node you keep.\n\n"
        "```json\n" + json.dumps(current, indent=2) + "\n```"
    )


def _preview(text: str) -> str:
    text = " ".join((text or "").split())
    if len(text) <= INSTRUCTIONS_PREVIEW_CHARS:
        return text
    return text[:INSTRUCTIONS_PREVIEW_CHARS].rstrip() + "…"
