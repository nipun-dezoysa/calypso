import axiosInstance from "./axiosInstance";

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
