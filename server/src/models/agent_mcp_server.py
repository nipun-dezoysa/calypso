from sqlalchemy import Column, ForeignKey, Table
from src.database import Base

agent_mcp_server = Table(
    "agent_mcp_servers",
    Base.metadata,
    Column(
        "agent_id",
        ForeignKey("agents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "mcp_server_id",
        ForeignKey("mcp_servers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
