import axiosInstance from './axiosInstance'

export interface ChatThread {
    id: string
    type: 'agent' | 'workflow'
    agent_id: string | null
    workflow_id: string | null
    title: string | null
    created_at: string
    updated_at: string
}

export interface ChatMessage {
    id: string
    thread_id: string
    is_bot: boolean
    content: string
    created_at: string
}

export interface ChatAskRequest {
    question: string
    thread_id?: string | null
}

export interface ChatAskResponse {
    thread_id: string
    answer: string
}

const BASE = '/api/v1/chat'

// LLM responses can take well over the default 15s axios timeout.
const ASK_TIMEOUT_MS = 120_000

// `targetId` may be an agent id or a workflow id — the server decides.
export async function ask(targetId: string, data: ChatAskRequest): Promise<ChatAskResponse> {
    const response = await axiosInstance.post<ChatAskResponse>(
        `${BASE}/${targetId}/ask`,
        data,
        { timeout: ASK_TIMEOUT_MS },
    )
    return response.data
}

export async function listThreads(targetId: string): Promise<ChatThread[]> {
    const response = await axiosInstance.get<ChatThread[]>(`${BASE}/${targetId}/threads`)
    return response.data
}

export async function listThreadMessages(threadId: string): Promise<ChatMessage[]> {
    const response = await axiosInstance.get<ChatMessage[]>(`${BASE}/threads/${threadId}/messages`)
    return response.data
}
