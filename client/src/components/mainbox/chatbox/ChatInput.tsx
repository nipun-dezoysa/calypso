import { useEffect, useRef, useState } from "react";
import { IoAdd, IoArrowUp, IoStop } from "react-icons/io5";
import DropdownSelector, {
  type SelectOption,
} from "../../common/DropdownSelector";
import { listAgents, updateAgent, type Agent } from "../../../api/agentApi";
import { listCollections, type Collection } from "../../../api/kbApi";
import { listMcpServers, type McpServer } from "../../../api/mcpApi";
import { SUPPORTED_ATTACHMENT_TYPES } from "../../../api/chatApi";
import { useChatStore } from "../../../stores/ChatStore";
import AttachmentChip from "./AttachmentChip";
import AutoGrowTextarea from "../../common/AutoGrowTextarea";

const AGENT_PLACEHOLDER: SelectOption = { id: "", name: "Select an agent" };

function ChatInput() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [text, setText] = useState("");
  const [savingKBs, setSavingKBs] = useState(false);
  const [savingMcps, setSavingMcps] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetId = useChatStore((s) => s.targetId);
  const targetType = useChatStore((s) => s.targetType);
  const targetName = useChatStore((s) => s.targetName);
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const selectAgent = useChatStore((s) => s.selectAgent);
  const patchSelectedAgent = useChatStore((s) => s.patchSelectedAgent);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const sending = useChatStore((s) => s.sending);
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const uploadingCount = useChatStore((s) => s.uploadingCount);
  const attachFiles = useChatStore((s) => s.attachFiles);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  useEffect(() => {
    let cancelled = false;
    listAgents({ limit: 100 })
      .then((data) => {
        if (cancelled) return;
        setAgents(data);
        const current = useChatStore.getState().targetId;
        if (!current && data.length > 0) selectAgent(data[0]);
      })
      .catch(() => {
        // Agent list failures already surface in the sidebar.
      });
    return () => {
      cancelled = true;
    };
  }, [selectAgent]);

  useEffect(() => {
    let cancelled = false;
    listCollections({ limit: 100 })
      .then((data) => {
        if (!cancelled) setCollections(data);
      })
      .catch(() => {
        // Non-critical: the KB picker just stays empty on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMcpServers({ limit: 100 })
      .then((data) => {
        if (!cancelled) setMcpServers(data);
      })
      .catch(() => {
        // Non-critical: the MCP picker just stays empty on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kbOptions: SelectOption[] = collections.map((c) => ({
    id: c.id,
    name: c.name,
    description: `${c.document_count} doc${c.document_count === 1 ? "" : "s"}`,
  }));

  const selectedKBs: SelectOption[] = (selectedAgent?.collections ?? []).map(
    (c) => ({
      id: c.id,
      name: c.name,
    }),
  );

  async function handleChangeKBs(options: SelectOption[]) {
    if (!selectedAgent || savingKBs) return;
    const collection_ids = options.map((o) => o.id);
    setSavingKBs(true);
    try {
      const updated = await updateAgent(selectedAgent.id, { collection_ids });
      patchSelectedAgent(updated);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      // Keep the previous selection on failure; nothing to persist.
    } finally {
      setSavingKBs(false);
    }
  }

  const mcpOptions: SelectOption[] = mcpServers.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.transport,
  }));

  const selectedMcpOptions: SelectOption[] = (
    selectedAgent?.mcp_servers ?? []
  ).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  async function handleChangeMcps(options: SelectOption[]) {
    if (!selectedAgent || savingMcps) return;
    const mcp_server_ids = options.map((o) => o.id);
    setSavingMcps(true);
    try {
      const updated = await updateAgent(selectedAgent.id, { mcp_server_ids });
      patchSelectedAgent(updated);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      // Keep the previous selection on failure; nothing to persist.
    } finally {
      setSavingMcps(false);
    }
  }

  const agentOptions: SelectOption[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    description: `${a.llm_model.provider_name} · ${a.llm_model.model_name}`,
  }));

  const selectedOption: SelectOption = targetId
    ? { id: targetId, name: targetName ?? "" }
    : AGENT_PLACEHOLDER;

  const uploading = uploadingCount > 0;
  // An attachment on its own is a message; text is not required.
  const hasContent = text.trim().length > 0 || pendingAttachments.length > 0;
  const canSend = Boolean(targetId) && hasContent && !sending && !uploading;
  const canAttach = Boolean(targetId) && !sending;

  function handleSend() {
    if (!canSend) return;
    const question = text.trim();
    setText("");
    void sendMessage(question);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !canAttach) return;
    void attachFiles(Array.from(files));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!canAttach) return;
    // Only light up for files — dragging selected text should not look droppable.
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDraggingOver(true);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    handleFiles(e.clipboardData.files);
  }

  return (
    <div className="w-full bg-(--c-surface) px-4 absolute left-0 bottom-0 flex items-center justify-center pb-5 flex-col">
      <div
        className={`bg-(--c-bg) w-full max-w-4xl rounded-2xl p-3 border ${
          draggingOver ? "border-(--c-accent)" : "border-transparent"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDraggingOver(false)}
      >
        {(pendingAttachments.length > 0 || uploading) && (
          <div className="flex flex-wrap gap-2 pb-2">
            {pendingAttachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                onRemove={removeAttachment}
              />
            ))}
            {uploading && (
              <div className="flex items-center text-xs text-(--c-text-muted) animate-pulse px-2">
                Reading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}…
              </div>
            )}
          </div>
        )}

        <AutoGrowTextarea
          className="bg-transparent focus:outline-none text-(--c-text-body) placeholder:text-(--c-text-muted)"
          minRows={2}
          maxHeight={200}
          placeholder={
            targetId
              ? "Type your message here, or drop in a file..."
              : "Select an agent or workflow to start chatting..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={!targetId}
        />
        <div className="flex justify-between text-(--c-text-muted) items-center">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SUPPORTED_ATTACHMENT_TYPES}
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                // Reset so picking the same file twice still fires a change.
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAttach}
              className={`p-1 rounded ${
                canAttach
                  ? "hover:text-(--c-text-body) cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }`}
              title="Attach a PDF, Word document, text file or image"
              aria-label="Attach a file"
            >
              <IoAdd size={18} />
            </button>
            <span className="text-(--c-text-subtle)">·</span>
            <DropdownSelector
              options={agentOptions}
              selected={selectedOption}
              onSelect={(option) => {
                const agent = agents.find((a) => a.id === option.id);
                if (agent) selectAgent(agent);
              }}
              label="Select an agent"
            />
            {targetType === "workflow" && (
              <span className="text-[11px] text-(--c-accent)/80 border border-(--c-accent-lo)/40 rounded px-1.5 py-0.5">
                Workflow
              </span>
            )}
            {targetType === "agent" && (
              <>
                <span className="text-(--c-text-subtle)">·</span>
                <DropdownSelector
                  options={kbOptions}
                  selected={selectedKBs}
                  onSelect={handleChangeKBs}
                  label="Knowledgebases"
                  multiple
                />
                <span className="text-(--c-text-subtle)">·</span>
                <DropdownSelector
                  options={mcpOptions}
                  selected={selectedMcpOptions}
                  onSelect={handleChangeMcps}
                  label="MCP Servers"
                  multiple
                />
              </>
            )}
          </div>
          <button
            className={`p-2 rounded-sm text-white ${
              sending || canSend
                ? "bg-(--c-accent) cursor-pointer"
                : "bg-(--c-border) cursor-not-allowed"
            }`}
            onClick={sending ? stopStreaming : handleSend}
            disabled={!sending && !canSend}
            aria-label={sending ? "Stop generating" : "Send message"}
            title={
              sending
                ? "Stop generating — the part already written is kept"
                : "Send message"
            }
          >
            {sending ? <IoStop /> : <IoArrowUp />}
          </button>
        </div>
      </div>
      <div className="text-(--c-text-muted) text-xs pt-2">
        AI models can make mistakes. Check important info.
      </div>
    </div>
  );
}

export default ChatInput;
