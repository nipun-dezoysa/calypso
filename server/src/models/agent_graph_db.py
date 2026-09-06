from sqlalchemy import Column, ForeignKey, Table
from src.database import Base

agent_graph_db = Table(
    "agent_graph_dbs",
    Base.metadata,
    Column(
        "agent_id",
        ForeignKey("agents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "graph_db_id",
        ForeignKey("graph_databases.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
