import json

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.agent_model import Agent
from src.models.kb_collection_model import KbCollection
from src.models.llm_model import LLMModel
from src.models.mcp_server_model import McpServer
from src.schemas.workflow_designer_schema import (
    DesignRequest,
    DesignResponse,
    DraftWorkflow,
)
from src.services import langfuse_tracing
from src.services.langfuse_settings_service import LangfuseSettingsService
from src.services.llm_factory import build_chat_model
from src.services.workflow_designer_prompt import build_system_prompt
from src.services.workflow_designer_repair import Catalog, repair_proposal

DESIGNER_CREATIVITY = 15
MAX_HISTORY_MESSAGES = 12
CATALOG_LIMIT = 200


class WorkflowDesignerService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def design(self, data: DesignRequest) -> DesignResponse | None:
        """Run one designer turn. None when the requested model is gone."""
        model = await self.db.get(LLMModel, data.llm_model_id)
        if model is None:
            return None

        agents, models, collections, servers = await self._load_catalog()
        system = build_system_prompt(agents, models, collections, servers, data.workflow)

        chat_model = build_chat_model(
            provider=model.ai_provider,
            model_name=model.model_name,
            temperature=round(DESIGNER_CREATIVITY / 100, 2),
        )
        await LangfuseSettingsService(self.db).activate()
        with langfuse_tracing.trace_run(
            name="workflow designer",
            input=data.message,
            tags=["designer"],
            metadata={"model": model.model_name},
        ) as span:
            response = await chat_model.ainvoke(
                [
                    SystemMessage(content=system),
                    *_history(data),
                    HumanMessage(content=data.message),
                ],
                config=langfuse_tracing.callbacks("workflow designer") or None,
            )
            text = _stringify(response.content)
            langfuse_tracing.record_output(span, text)

        return _interpret(text, data.workflow, _catalog_ids(agents, models, collections, servers), model.id)

    async def _load_catalog(
        self,
    ) -> tuple[list[Agent], list[LLMModel], list[KbCollection], list[McpServer]]:
        return (
            await self._all(Agent, Agent.name),
            await self._all(LLMModel, LLMModel.model_name),
            await self._all(KbCollection, KbCollection.name),
            await self._all(McpServer, McpServer.name),
        )

    async def _all(self, model, order_by):
        result = await self.db.execute(select(model).order_by(order_by).limit(CATALOG_LIMIT))
        return list(result.scalars().unique().all())


def _interpret(
    text: str,
    draft: DraftWorkflow,
    catalog: Catalog,
    fallback_model_id: str,
) -> DesignResponse:
    payload = _extract_json(text)
    if payload is None:
        return DesignResponse(reply=_plain_text(text), workflow=None, notes=[])

    reply = str(payload.get("reply") or "").strip()
    raw_workflow = payload.get("workflow")

    if not isinstance(raw_workflow, dict):
        return DesignResponse(reply=reply or _plain_text(text), workflow=None, notes=[])

    proposal, notes = repair_proposal(raw_workflow, draft, catalog, fallback_model_id)
    if proposal is None:
        return DesignResponse(
            reply=reply or "I could not turn that into a workflow. Try describing it another way.",
            workflow=None,
            notes=notes,
        )
    return DesignResponse(
        reply=reply or "Here is the workflow. Review it on the canvas and save it if it looks right.",
        workflow=proposal,
        notes=notes,
    )


def _history(data: DesignRequest) -> list[AIMessage | HumanMessage]:
    turns = data.history[-MAX_HISTORY_MESSAGES:]
    return [
        AIMessage(content=m.content) if m.role == "assistant" else HumanMessage(content=m.content)
        for m in turns
        if m.content.strip()
    ]


def _extract_json(text: str) -> dict | None:
    text = _plain_text(text)
    bare_graph: dict | None = None

    for start in (i for i, ch in enumerate(text) if ch == "{"):
        candidate = _balanced_object(text, start)
        if candidate is None:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict):
            continue
        if "reply" in parsed or "workflow" in parsed:
            return parsed
        if bare_graph is None and isinstance(parsed.get("nodes"), list):
            bare_graph = parsed

    if bare_graph is not None:
        return {"reply": "", "workflow": bare_graph}
    return None


def _balanced_object(text: str, start: int) -> str | None:
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _plain_text(text: str) -> str:
    """Strip the reasoning block some models emit before their real answer."""
    while True:
        opened = text.find("<think>")
        if opened == -1:
            break
        closed = text.find("</think>", opened)
        if closed == -1:
            text = text[:opened]
            break
        text = text[:opened] + text[closed + len("</think>") :]
    return text.strip()


def _stringify(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text") or "")
            else:
                parts.append(str(block))
        return "\n".join(p for p in parts if p)
    return str(content)


def _catalog_ids(
    agents: list[Agent],
    models: list[LLMModel],
    collections: list[KbCollection],
    servers: list[McpServer],
) -> Catalog:
    return Catalog(
        agent_ids={a.id for a in agents},
        model_ids={m.id for m in models},
        collection_ids={c.id for c in collections},
        server_ids={s.id for s in servers},
    )
