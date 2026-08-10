import axiosInstance, { BASE_URL, TOKEN_STORAGE_KEY } from "./axiosInstance";

export interface ChatThread {
  id: string;
  type: "agent" | "workflow";
  agent_id: string | null;
  workflow_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export type AttachmentKind = "document" | "image";
export const SUPPORTED_ATTACHMENT_TYPES =
  ".pdf,.txt,.md,.markdown,.docx,.png,.jpg,.jpeg";

export interface ChatAttachment {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  kind: AttachmentKind;
  status: "completed" | "failed";
  error_message: string | null;
  has_text: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  is_bot: boolean;
  content: string;
  created_at: string;
  attachments?: ChatAttachment[];
}

export interface ChatAskRequest {
  question: string;
  thread_id?: string | null;
  attachment_ids?: string[];
}

export interface ChatAskResponse {
  thread_id: string;
  answer: string;
}

const BASE = "/api/v1/chat";

// LLM responses can take well over the default 15s axios timeout.
const ASK_TIMEOUT_MS = 120_000;

// `targetId` may be an agent id or a workflow id — the server decides.
export async function ask(
  targetId: string,
  data: ChatAskRequest,
): Promise<ChatAskResponse> {
  const response = await axiosInstance.post<ChatAskResponse>(
    `${BASE}/${targetId}/ask`,
    data,
    { timeout: ASK_TIMEOUT_MS },
  );
  return response.data;
}

export type ChatStreamEvent =
  | { type: "start"; thread_id: string }
  | { type: "token"; text: string }
  | { type: "node"; name: string }
  | { type: "tool"; name: string }
  | { type: "done"; thread_id: string; stopped: boolean; answer: string }
  | { type: "error"; detail: string };

async function streamError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg: string }) => d.msg).join("; ");
    }
  } catch {
    // No JSON body
  }
  return `Request failed with status ${response.status}`;
}

export async function askStream(
  targetId: string,
  data: ChatAskRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const response = await fetch(`${BASE_URL}${BASE}/${targetId}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(await streamError(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const payload = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (payload) onEvent(JSON.parse(payload) as ChatStreamEvent);
      end = buffer.indexOf("\n\n");
    }
  }
}

export async function listThreads(targetId: string): Promise<ChatThread[]> {
  const response = await axiosInstance.get<ChatThread[]>(
    `${BASE}/${targetId}/threads`,
  );
  return response.data;
}

export async function deleteThread(threadId: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/threads/${threadId}`);
}

export async function listThreadMessages(
  threadId: string,
): Promise<ChatMessage[]> {
  const response = await axiosInstance.get<ChatMessage[]>(
    `${BASE}/threads/${threadId}/messages`,
  );
  return response.data;
}

const UPLOAD_TIMEOUT_MS = 60_000;

export async function uploadAttachment(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const response = await axiosInstance.post<ChatAttachment>(
    `${BASE}/attachments`,
    form,
    {
      timeout: UPLOAD_TIMEOUT_MS,
      headers: { "Content-Type": undefined },
    },
  );
  return response.data;
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/attachments/${attachmentId}`);
}

export async function fetchAttachmentBlob(attachmentId: string): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(
    `${BASE}/attachments/${attachmentId}/content`,
    { responseType: "blob" },
  );
  return response.data;
}
