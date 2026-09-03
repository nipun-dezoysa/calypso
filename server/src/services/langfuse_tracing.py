import logging
import threading
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass

from src.models.langfuse_settings_model import LangfuseSettings

logger = logging.getLogger(__name__)

AUTH_CHECK_TIMEOUT_SECONDS = 10

# What the UI offers when the host field is left empty.
DEFAULT_HOST = "https://cloud.langfuse.com"


@dataclass(frozen=True)
class LangfuseConfig:
    """Immutable snapshot of the resolved Langfuse settings."""

    enabled: bool
    host: str
    public_key: str | None
    secret_key: str | None
    environment: str | None
    sample_rate: float

    @classmethod
    def from_settings(cls, row: LangfuseSettings | None) -> "LangfuseConfig":
        """Read the saved settings. A missing row is the untouched state:
        tracing off, nothing configured."""
        if row is None:
            return cls(
                enabled=False,
                host=DEFAULT_HOST,
                public_key=None,
                secret_key=None,
                environment=None,
                sample_rate=1.0,
            )
        return cls(
            enabled=bool(row.enabled),
            host=(row.host or DEFAULT_HOST).rstrip("/"),
            public_key=row.public_key or None,
            secret_key=row.secret_key or None,
            environment=row.environment or None,
            sample_rate=1.0 if row.sample_rate is None else row.sample_rate,
        )

    @property
    def is_complete(self) -> bool:
        """Whether there is enough here to talk to a Langfuse server at all."""
        return bool(self.public_key and self.secret_key and self.host)

    @property
    def is_active(self) -> bool:
        return self.enabled and self.is_complete

    def fingerprint(self) -> tuple:
        """What has to change for the client to need rebuilding."""
        return (
            self.enabled,
            self.host,
            self.public_key,
            self.secret_key,
            self.environment,
            self.sample_rate,
        )


class _Tracer:
    """Holds the live client and handler, rebuilt on a config change."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fingerprint: tuple | None = None
        self._client = None
        self._handler = None

    def apply(self, cfg: LangfuseConfig) -> None:
        with self._lock:
            if self._fingerprint == cfg.fingerprint():
                return
            self._teardown()
            self._fingerprint = cfg.fingerprint()
            if not cfg.is_active:
                if cfg.enabled:
                    logger.warning(
                        "Langfuse is switched on but the host, public key or "
                        "secret key is missing; tracing stays off."
                    )
                return
            try:
                self._client, self._handler = _build(cfg)
            except Exception:  # noqa: BLE001 - tracing must never break a run
                logger.exception("Could not start Langfuse tracing; continuing without it")
                self._client = None
                self._handler = None

    @property
    def handler(self):
        return self._handler

    @property
    def client(self):
        return self._client

    def shutdown(self) -> None:
        with self._lock:
            self._teardown()
            self._fingerprint = None

    def _teardown(self) -> None:
        """Drop the current client. Langfuse caches its resource manager by
        public key, so a plain re-init would hand back the old credentials —
        the registry has to be cleared as well."""
        if self._client is not None:
            try:
                self._client.shutdown()
            except Exception:  # noqa: BLE001
                logger.exception("Langfuse shutdown failed")
        self._client = None
        self._handler = None
        try:
            from langfuse._client.resource_manager import LangfuseResourceManager

            LangfuseResourceManager.reset()
        except Exception:  # noqa: BLE001 - private API, best effort only
            pass


def _build(cfg: LangfuseConfig):
    from langfuse import Langfuse
    from langfuse.langchain import CallbackHandler

    client = Langfuse(
        public_key=cfg.public_key,
        secret_key=cfg.secret_key,
        host=cfg.host,
        environment=cfg.environment,
        sample_rate=cfg.sample_rate,
        tracing_enabled=True,
    )
    return client, CallbackHandler(public_key=cfg.public_key)


_tracer = _Tracer()


def apply(cfg: LangfuseConfig) -> None:
    """Point the tracer at this config, rebuilding the client if it changed."""
    _tracer.apply(cfg)


def is_active() -> bool:
    """Whether runs are actually being traced right now."""
    return _tracer.handler is not None


def shutdown() -> None:
    _tracer.shutdown()


def callbacks(name: str | None = None) -> dict:
    handler = _tracer.handler
    if handler is None:
        return {}
    config: dict = {"callbacks": [handler]}
    if name:
        config["run_name"] = name
    return config


@contextmanager
def trace_run(
    *,
    name: str,
    session_id: str | None = None,
    user_id: str | None = None,
    tags: list[str] | None = None,
    input: object = None,
    metadata: dict | None = None,
    as_type: str = "chain",
):
    client = _tracer.client
    if client is None or _tracer.handler is None:
        yield None
        return

    stack = ExitStack()
    try:
        from langfuse import propagate_attributes

        span = stack.enter_context(
            client.start_as_current_observation(
                name=name, as_type=as_type, input=input, metadata=metadata
            )
        )
        stack.enter_context(
            propagate_attributes(
                trace_name=name,
                session_id=session_id,
                user_id=user_id,
                tags=tags,
            )
        )
    except Exception:  # noqa: BLE001 - never let tracing break a chat turn
        logger.exception("Could not open a Langfuse span for %r", name)
        stack.close()
        yield None
        return

    with stack:
        yield span


def record_output(span, output: object) -> None:
    """Attach the finished text to a span. Safe to call with None."""
    if span is None:
        return
    try:
        span.update(output=output)
    except Exception:  # noqa: BLE001
        logger.exception("Could not record Langfuse output")


async def auth_check(cfg: LangfuseConfig) -> tuple[bool, str]:
    if not cfg.is_complete:
        return False, "Host, public key and secret key are all required."

    import httpx

    url = f"{cfg.host}/api/public/projects"
    try:
        async with httpx.AsyncClient(timeout=AUTH_CHECK_TIMEOUT_SECONDS) as client:
            response = await client.get(
                url, auth=(cfg.public_key or "", cfg.secret_key or "")
            )
    except Exception as exc:  # noqa: BLE001 - surface the reason to the UI
        return False, f"Could not reach Langfuse at {cfg.host}: {exc}"

    if response.status_code in (401, 403):
        return False, "Langfuse rejected these credentials."
    if response.status_code == 404:
        return False, f"No Langfuse API at {cfg.host}. Check the host URL."
    if response.status_code >= 400:
        return False, f"Langfuse answered with HTTP {response.status_code}."

    try:
        projects = response.json().get("data", [])
    except ValueError:
        return False, f"{cfg.host} did not answer with JSON. Check the host URL."

    if not projects:
        return False, "These keys are not attached to a project."

    name = projects[0].get("name") or projects[0].get("id") or "a project"
    return True, f"Connected to '{name}' at {cfg.host}."
