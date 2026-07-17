import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient

DEFAULT_TIMEOUT_SECONDS = 20.0


async def fetch_tools(
    name: str,
    connection: dict,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> list[tuple[str, str | None]]:
    client = MultiServerMCPClient({name: connection})
    tools = await asyncio.wait_for(client.get_tools(), timeout=timeout)
    return [(t.name, getattr(t, "description", None)) for t in tools]


async def load_tools(
    connections: dict[str, dict],
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> list:
    if not connections:
        return []
    client = MultiServerMCPClient(connections)
    return await asyncio.wait_for(client.get_tools(), timeout=timeout)
