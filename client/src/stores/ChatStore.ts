import { create } from 'zustand'
import type { Agent } from '../api/agentApi'
import {
    ask,
    listThreadMessages,
    listThreads,
    type ChatMessage,
    type ChatThread,
} from '../api/chatApi'

export type ChatTargetType = 'agent' | 'workflow'

interface ChatState {
    // The active chat target — an agent or a workflow.
    targetId: string | null
    targetType: ChatTargetType | null
    targetName: string | null
    // The full agent object when the target is an agent (drives the agent-only KB/MCP editors in the chat input); null for workflow targets.
    selectedAgent: Agent | null

    threadId: string | null
    messages: ChatMessage[]
    threads: ChatThread[]
    sending: boolean
    loadingMessages: boolean
    error: string | null

    selectAgent: (agent: Agent | null) => void
    selectWorkflow: (workflow: { id: string; name: string }) => void
    patchSelectedAgent: (agent: Agent) => void
    newChat: () => void
    openThread: (threadId: string) => Promise<void>
    sendMessage: (question: string) => Promise<void>
    refreshThreads: () => Promise<void>
}

const resetConversation = (): Pick<ChatState, 'threadId' | 'messages' | 'threads' | 'error'> => ({
    threadId: null,
    messages: [],
    threads: [],
    error: null,
})

export const useChatStore = create<ChatState>((set, get) => ({
    targetId: null,
    targetType: null,
    targetName: null,
    selectedAgent: null,
    threadId: null,
    messages: [],
    threads: [],
    sending: false,
    loadingMessages: false,
    error: null,

    selectAgent: (agent) => {
        if (agent === null) {
            set({ targetId: null, targetType: null, targetName: null, selectedAgent: null, ...resetConversation() })
            return
        }
        if (get().targetType === 'agent' && get().targetId === agent.id) {
            // Same agent re-selected — keep its full object fresh but don't reset.
            set({ selectedAgent: agent })
            return
        }
        set({
            targetId: agent.id,
            targetType: 'agent',
            targetName: agent.name,
            selectedAgent: agent,
            ...resetConversation(),
        })
        void get().refreshThreads()
    },

    selectWorkflow: (workflow) => {
        if (get().targetType === 'workflow' && get().targetId === workflow.id) return
        set({
            targetId: workflow.id,
            targetType: 'workflow',
            targetName: workflow.name,
            selectedAgent: null,
            ...resetConversation(),
        })
        void get().refreshThreads()
    },

    // Replace the selected agent in place (e.g. after editing its KBs/MCPs)
    // without resetting the current thread or messages.
    patchSelectedAgent: (agent) => {
        if (get().targetType !== 'agent' || get().targetId !== agent.id) return
        set({ selectedAgent: agent, targetName: agent.name })
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
        const targetId = get().targetId
        if (!targetId) return
        try {
            const threads = await listThreads(targetId)
            if (get().targetId !== targetId) return
            set({ threads })
        } catch {
            // Thread list is non-critical; keep whatever we had.
        }
    },

    sendMessage: async (question) => {
        const targetId = get().targetId
        if (!targetId || get().sending) return
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
            const res = await ask(targetId, { question, thread_id: threadId })
            // User may have switched target or thread while waiting.
            if (get().targetId !== targetId || get().threadId !== threadId) {
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
            if (get().targetId !== targetId || get().threadId !== threadId) {
                set({ sending: false })
                return
            }
            set({ sending: false, error: message })
        }
    },
}))
