from sqlalchemy import Column, ForeignKey, Table
from src.database import Base

workflow_agent_collection = Table(
    "workflow_agent_collections",
    Base.metadata,
    Column(
        "workflow_agent_id",
        ForeignKey("workflow_agents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "collection_id",
        ForeignKey("kb_collections.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

workflow_agent_mcp_server = Table(
    "workflow_agent_mcp_servers",
    Base.metadata,
    Column(
        "workflow_agent_id",
        ForeignKey("workflow_agents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "mcp_server_id",
        ForeignKey("mcp_servers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
