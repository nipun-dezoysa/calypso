import { create } from 'zustand'
import type { Agent } from '../api/agentApi'
import {
    ask,
    deleteAttachment,
    deleteThread,
    listThreadMessages,
    listThreads,
    uploadAttachment,
    type ChatAttachment,
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

    // Files uploaded and extracted, waiting to go out with the next message.
    pendingAttachments: ChatAttachment[]
    // How many uploads are still in flight, so the composer can block sending.
    uploadingCount: number

    selectAgent: (agent: Agent | null) => void
    selectWorkflow: (workflow: { id: string; name: string }) => void
    patchSelectedAgent: (agent: Agent) => void
    newChat: () => void
    openThread: (threadId: string) => Promise<void>
    removeThread: (threadId: string) => Promise<void>
    sendMessage: (question: string) => Promise<void>
    refreshThreads: () => Promise<void>
    attachFiles: (files: File[]) => Promise<void>
    removeAttachment: (attachmentId: string) => Promise<void>
}

const resetConversation = (): Pick<
    ChatState,
    'threadId' | 'messages' | 'threads' | 'error' | 'pendingAttachments'
> => ({
    threadId: null,
    messages: [],
    threads: [],
    error: null,
    // Uploads belong to the conversation they were staged in; the server
    // sweeps whatever is left unsent.
    pendingAttachments: [],
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
    pendingAttachments: [],
    uploadingCount: 0,

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

    newChat: () => set({ threadId: null, messages: [], error: null, pendingAttachments: [] }),

    openThread: async (threadId) => {
        set({ threadId, messages: [], loadingMessages: true, error: null, pendingAttachments: [] })
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

    removeThread: async (threadId) => {
        const previous = get().threads
        // Drop it optimistically; if the delete fails we put the list back.
        set((s) => ({
            threads: s.threads.filter((t) => t.id !== threadId),
            error: null,
            // Deleting the open thread leaves the chat on a fresh conversation.
            ...(s.threadId === threadId ? { threadId: null, messages: [] } : {}),
        }))
        try {
            await deleteThread(threadId)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete chat'
            set({ threads: previous, error: message })
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

    attachFiles: async (files) => {
        if (files.length === 0) return
        set((s) => ({ uploadingCount: s.uploadingCount + files.length, error: null }))
        for (const file of files) {
            try {
                const attachment = await uploadAttachment(file)
                set((s) => ({
                    pendingAttachments: [...s.pendingAttachments, attachment],
                    uploadingCount: s.uploadingCount - 1,
                }))
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Upload failed'
                set((s) => ({
                    uploadingCount: s.uploadingCount - 1,
                    error: `${file.name}: ${message}`,
                }))
            }
        }
    },

    removeAttachment: async (attachmentId) => {
        set((s) => ({
            pendingAttachments: s.pendingAttachments.filter((a) => a.id !== attachmentId),
        }))
        try {
            await deleteAttachment(attachmentId)
        } catch {
            // It is off the message either way; the server sweeps it later.
        }
    },

    sendMessage: async (question) => {
        const targetId = get().targetId
        if (!targetId || get().sending) return
        const threadId = get().threadId
        const attachments = get().pendingAttachments

        const optimistic: ChatMessage = {
            id: `pending-${Date.now()}`,
            thread_id: threadId ?? '',
            is_bot: false,
            content: question,
            created_at: new Date().toISOString(),
            attachments,
        }
        set((s) => ({
            messages: [...s.messages, optimistic],
            sending: true,
            error: null,
            pendingAttachments: [],
        }))

        try {
            const res = await ask(targetId, {
                question,
                thread_id: threadId,
                attachment_ids: attachments.map((a) => a.id),
            })
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
