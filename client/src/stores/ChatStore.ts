import { create } from 'zustand'
import type { Agent } from '../api/agentApi'
import {
    askAgent,
    listThreadMessages,
    listThreads,
    type ChatMessage,
    type ChatThread,
} from '../api/chatApi'

interface ChatState {
    selectedAgent: Agent | null
    threadId: string | null
    messages: ChatMessage[]
    threads: ChatThread[]
    sending: boolean
    loadingMessages: boolean
    error: string | null
    selectAgent: (agent: Agent | null) => void
    newChat: () => void
    openThread: (threadId: string) => Promise<void>
    sendMessage: (question: string) => Promise<void>
    refreshThreads: () => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
    selectedAgent: null,
    threadId: null,
    messages: [],
    threads: [],
    sending: false,
    loadingMessages: false,
    error: null,

    selectAgent: (agent) => {
        if (get().selectedAgent?.id === agent?.id) return
        set({
            selectedAgent: agent,
            threadId: null,
            messages: [],
            threads: [],
            error: null,
        })
        if (agent) void get().refreshThreads()
    },

    newChat: () => set({ threadId: null, messages: [], error: null }),

    openThread: async (threadId) => {
        set({ threadId, messages: [], loadingMessages: true, error: null })
        try {
            const messages = await listThreadMessages(threadId)
            if (get().threadId !== threadId) return
            set({ messages, loadingMessages: false })
        } catch (err: unknown) {
            if (get().threadId !== threadId) return
            const message = err instanceof Error ? err.message : 'Failed to load messages'
            set({ loadingMessages: false, error: message })
        }
    },

    refreshThreads: async () => {
        const agent = get().selectedAgent
        if (!agent) return
        try {
            const threads = await listThreads(agent.id)
            if (get().selectedAgent?.id !== agent.id) return
            set({ threads })
        } catch {
            // Thread list is non-critical; keep whatever we had.
        }
    },

    sendMessage: async (question) => {
        const agent = get().selectedAgent
        if (!agent || get().sending) return
        const threadId = get().threadId

        const optimistic: ChatMessage = {
            id: `pending-${Date.now()}`,
            thread_id: threadId ?? '',
            is_bot: false,
            content: question,
            created_at: new Date().toISOString(),
        }
        set((s) => ({ messages: [...s.messages, optimistic], sending: true, error: null }))

        try {
            const res = await askAgent(agent.id, { question, thread_id: threadId })
            // User may have switched agent or thread while waiting.
            if (get().selectedAgent?.id !== agent.id || get().threadId !== threadId) {
                set({ sending: false })
                return
            }
            const botMessage: ChatMessage = {
                id: `bot-${Date.now()}`,
                thread_id: res.thread_id,
                is_bot: true,
                content: res.answer,
                created_at: new Date().toISOString(),
            }
            set((s) => ({
                messages: [...s.messages, botMessage],
                threadId: res.thread_id,
                sending: false,
            }))
            void get().refreshThreads()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to send message'
            if (get().selectedAgent?.id !== agent.id || get().threadId !== threadId) {
                set({ sending: false })
                return
            }
            set({ sending: false, error: message })
        }
    },
}))
