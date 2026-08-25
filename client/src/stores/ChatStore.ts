import { create } from 'zustand'
import type { Agent } from '../api/agentApi'
import {
    askStream,
    deleteAttachment,
    deleteThread,
    editMessageStream,
    listThreadMessages,
    listThreads,
    regenerateStream,
    uploadAttachment,
    type ChatAttachment,
    type ChatMessage,
    type ChatThread,
} from '../api/chatApi'

export type ChatTargetType = 'agent' | 'workflow'

/** The stream in flight, so the stop button has something to pull on. */
let activeStream: AbortController | null = null

// A stopped run is still being saved server-side when the client lets go of the
// connection. The thread list catches up a moment later.
const SAVE_SETTLE_MS = 1500

// Ids for messages not yet round-tripped through the server. Regenerate/edit
// need the real database id, so callers should hide those actions until a
// message's id no longer looks like this (see `refreshMessages`).
const SYNTHETIC_ID_PREFIXES = ['pending-', 'bot-']

export function isSyntheticMessageId(id: string): boolean {
    return SYNTHETIC_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
}

function botMessage(threadId: string, content: string): ChatMessage {
    return {
        id: `bot-${Date.now()}`,
        thread_id: threadId,
        is_bot: true,
        content,
        created_at: new Date().toISOString(),
    }
}

interface ChatState {
    // The active chat target: an agent or a workflow.
    targetId: string | null
    targetType: ChatTargetType | null
    targetName: string | null
    // The full agent object when the target is an agent (drives the agent-only KB/MCP editors in the chat input); null for workflow targets.
    selectedAgent: Agent | null

    // Bumped whenever the user navigates to a different conversation (new
    // chat, another thread, another agent/workflow). `sendMessage` can't use
    // `threadId` itself for this: a brand-new chat's `threadId` is `null`
    // until the run's own `done` event commits it, so comparing against
    // `threadId` would mistake that legitimate commit for the user having
    // navigated away. This counter only moves on actual navigation.
    conversationEpoch: number

    threadId: string | null
    messages: ChatMessage[]
    threads: ChatThread[]
    sending: boolean
    loadingMessages: boolean
    error: string | null

    // The answer as it arrives. Cleared once it lands in `messages`.
    streamingText: string
    // For workflow targets, the node currently answering.
    streamingStep: string | null
    // The MCP tool currently running, if any.
    streamingTool: string | null

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
    regenerateMessage: (messageId: string) => Promise<void>
    editMessage: (messageId: string, content: string) => Promise<void>
    stopStreaming: () => void
    refreshThreads: () => Promise<void>
    refreshMessages: (threadId: string) => Promise<void>
    attachFiles: (files: File[]) => Promise<void>
    removeAttachment: (attachmentId: string) => Promise<void>
}

const resetConversation = (): Pick<
    ChatState,
    | 'threadId'
    | 'messages'
    | 'threads'
    | 'error'
    | 'pendingAttachments'
    | 'sending'
    | 'streamingText'
    | 'streamingStep'
    | 'streamingTool'
> => ({
    threadId: null,
    messages: [],
    threads: [],
    error: null,
    // Uploads belong to the conversation they were staged in; the server
    // sweeps whatever is left unsent.
    pendingAttachments: [],
    // A run already under way is left alone rather than aborted; it finishes
    // and saves in full, and its events are dropped as stale. Only the UI moves
    // on, so the composer is usable again straight away.
    sending: false,
    streamingText: '',
    streamingStep: null,
    streamingTool: null,
})

export const useChatStore = create<ChatState>((set, get) => ({
    targetId: null,
    targetType: null,
    targetName: null,
    selectedAgent: null,
    conversationEpoch: 0,
    threadId: null,
    messages: [],
    threads: [],
    sending: false,
    loadingMessages: false,
    error: null,
    pendingAttachments: [],
    uploadingCount: 0,
    streamingText: '',
    streamingStep: null,
    streamingTool: null,

    selectAgent: (agent) => {
        if (agent === null) {
            set((s) => ({
                targetId: null,
                targetType: null,
                targetName: null,
                selectedAgent: null,
                conversationEpoch: s.conversationEpoch + 1,
                ...resetConversation(),
            }))
            return
        }
        if (get().targetType === 'agent' && get().targetId === agent.id) {
            // Same agent re-selected, so keep its full object fresh but don't reset.
            set({ selectedAgent: agent })
            return
        }
        set((s) => ({
            targetId: agent.id,
            targetType: 'agent',
            targetName: agent.name,
            selectedAgent: agent,
            conversationEpoch: s.conversationEpoch + 1,
            ...resetConversation(),
        }))
        void get().refreshThreads()
    },

    selectWorkflow: (workflow) => {
        if (get().targetType === 'workflow' && get().targetId === workflow.id) return
        set((s) => ({
            targetId: workflow.id,
            targetType: 'workflow',
            targetName: workflow.name,
            selectedAgent: null,
            conversationEpoch: s.conversationEpoch + 1,
            ...resetConversation(),
        }))
        void get().refreshThreads()
    },

    // Replace the selected agent in place (e.g. after editing its KBs/MCPs)
    // without resetting the current thread or messages.
    patchSelectedAgent: (agent) => {
        if (get().targetType !== 'agent' || get().targetId !== agent.id) return
        set({ selectedAgent: agent, targetName: agent.name })
    },

    newChat: () =>
        set((s) => ({
            threadId: null,
            messages: [],
            error: null,
            pendingAttachments: [],
            sending: false,
            streamingText: '',
            streamingStep: null,
            streamingTool: null,
            conversationEpoch: s.conversationEpoch + 1,
        })),

    openThread: async (threadId) => {
        set((s) => ({
            threadId,
            messages: [],
            loadingMessages: true,
            error: null,
            pendingAttachments: [],
            sending: false,
            streamingText: '',
            streamingStep: null,
            streamingTool: null,
            conversationEpoch: s.conversationEpoch + 1,
        }))
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
            ...(s.threadId === threadId
                ? { threadId: null, messages: [], conversationEpoch: s.conversationEpoch + 1 }
                : {}),
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

    // Swaps client-side placeholder ids for the real ones once a turn has
    // landed, so regenerate/edit have a database id to act on.
    refreshMessages: async (threadId) => {
        try {
            const messages = await listThreadMessages(threadId)
            if (get().threadId !== threadId) return
            set({ messages })
        } catch {
            // Non-critical: ids just stay synthetic until the thread is reopened.
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
        }
        set((s) => ({
            messages: [...s.messages, optimistic],
            sending: true,
            error: null,
            pendingAttachments: [],
            streamingText: '',
            streamingStep: null,
            streamingTool: null,
        }))

        // The user may switch agent or thread mid-answer. The run carries on
        // server-side and saves in full; here its events are simply dropped.
        // `thread` tracks the id the run is writing to, which for a new thread
        // only becomes known once the `start` event arrives; the store's
        // `threadId` itself is deliberately left uncommitted until `done`
        // lands, so staleness can't be keyed off it (it changes as part of
        // this same run, not because the user navigated away), hence
        // `conversationEpoch`, which only moves on actual navigation.
        let thread = threadId
        const epoch = get().conversationEpoch
        const stale = () =>
            get().targetId !== targetId || get().conversationEpoch !== epoch

        const controller = new AbortController()
        activeStream = controller

        try {
            await askStream(
                targetId,
                {
                    question,
                    thread_id: threadId,
                    attachment_ids: attachments.map((a) => a.id),
                },
                (event) => {
                    if (stale()) return
                    switch (event.type) {
                        case 'start':
                            // Not committed to the store yet: a run that fails
                            // leaves no thread behind to point at.
                            thread = event.thread_id
                            break
                        case 'token':
                            set((s) => ({ streamingText: s.streamingText + event.text }))
                            break
                        case 'node':
                            // Each workflow step answers in turn and only the
                            // last one is the reply, so the view clears between
                            // them instead of running them together.
                            set({
                                streamingStep: event.name,
                                streamingText: '',
                                streamingTool: null,
                            })
                            break
                        case 'tool':
                            set({ streamingTool: event.name })
                            break
                        case 'error':
                            set({ error: event.detail })
                            break
                        case 'done':
                            set((s) => ({
                                messages: [
                                    ...s.messages,
                                    botMessage(event.thread_id, event.answer),
                                ],
                                threadId: event.thread_id,
                            }))
                            break
                    }
                },
                controller.signal,
            )
            if (!stale()) {
                set({
                    sending: false,
                    streamingText: '',
                    streamingStep: null,
                    streamingTool: null,
                })
            }
            void get().refreshThreads()
            if (thread) void get().refreshMessages(thread)
        } catch (err: unknown) {
            const stopped = err instanceof DOMException && err.name === 'AbortError'
            if (stale()) {
                set({ sending: false })
                return
            }
            if (stopped) {
                // The server saves the same text it just finished sending, so
                // what is on screen is kept as the message rather than thrown
                // away and re-fetched. Reopening the thread later replaces it
                // with the saved copy.
                const partial = get().streamingText
                set((s) => ({
                    sending: false,
                    streamingText: '',
                    streamingStep: null,
                    streamingTool: null,
                    threadId: thread ?? s.threadId,
                    messages: partial
                        ? [...s.messages, botMessage(thread ?? '', partial)]
                        : s.messages,
                }))
                window.setTimeout(() => void get().refreshThreads(), SAVE_SETTLE_MS)
                if (thread) window.setTimeout(() => void get().refreshMessages(thread!), SAVE_SETTLE_MS)
                return
            }
            const message = err instanceof Error ? err.message : 'Failed to send message'
            set({
                sending: false,
                error: message,
                streamingText: '',
                streamingStep: null,
                streamingTool: null,
            })
        } finally {
            if (activeStream === controller) activeStream = null
        }
    },

    regenerateMessage: async (messageId) => {
        const threadId = get().threadId
        if (!threadId || get().sending) return
        const messages = get().messages
        const botIndex = messages.findIndex((m) => m.id === messageId)
        if (botIndex === -1 || !messages[botIndex].is_bot) return

        // Drop the old answer optimistically; a fresh one lands via `done`.
        set({
            messages: messages.slice(0, botIndex),
            sending: true,
            error: null,
            streamingText: '',
            streamingStep: null,
            streamingTool: null,
        })

        const stale = () => get().threadId !== threadId
        const controller = new AbortController()
        activeStream = controller

        try {
            await regenerateStream(
                threadId,
                (event) => {
                    if (stale()) return
                    switch (event.type) {
                        case 'token':
                            set((s) => ({ streamingText: s.streamingText + event.text }))
                            break
                        case 'node':
                            set({ streamingStep: event.name, streamingText: '', streamingTool: null })
                            break
                        case 'tool':
                            set({ streamingTool: event.name })
                            break
                        case 'error':
                            set({ error: event.detail })
                            break
                        case 'done':
                            set((s) => ({
                                messages: [...s.messages, botMessage(event.thread_id, event.answer)],
                            }))
                            break
                    }
                },
                controller.signal,
            )
            if (!stale()) {
                set({ sending: false, streamingText: '', streamingStep: null, streamingTool: null })
            }
            void get().refreshMessages(threadId)
        } catch (err: unknown) {
            const stopped = err instanceof DOMException && err.name === 'AbortError'
            if (stale()) {
                set({ sending: false })
                return
            }
            if (stopped) {
                const partial = get().streamingText
                set((s) => ({
                    sending: false,
                    streamingText: '',
                    streamingStep: null,
                    streamingTool: null,
                    messages: partial ? [...s.messages, botMessage(threadId, partial)] : s.messages,
                }))
                window.setTimeout(() => void get().refreshMessages(threadId), SAVE_SETTLE_MS)
                return
            }
            const message = err instanceof Error ? err.message : 'Failed to regenerate the answer'
            set({ sending: false, error: message, streamingText: '', streamingStep: null, streamingTool: null })
        } finally {
            if (activeStream === controller) activeStream = null
        }
    },

    editMessage: async (messageId, content) => {
        const trimmed = content.trim()
        if (!trimmed) return
        const threadId = get().threadId
        if (!threadId || get().sending) return
        const messages = get().messages
        const userIndex = messages.findIndex((m) => m.id === messageId)
        if (userIndex === -1 || messages[userIndex].is_bot) return

        // Drop everything after the edited turn optimistically. Its old
        // answer and any later turns go away server-side too.
        set({
            messages: [
                ...messages.slice(0, userIndex),
                { ...messages[userIndex], content: trimmed },
            ],
            sending: true,
            error: null,
            streamingText: '',
            streamingStep: null,
            streamingTool: null,
        })

        const stale = () => get().threadId !== threadId
        const controller = new AbortController()
        activeStream = controller

        try {
            await editMessageStream(
                messageId,
                trimmed,
                (event) => {
                    if (stale()) return
                    switch (event.type) {
                        case 'token':
                            set((s) => ({ streamingText: s.streamingText + event.text }))
                            break
                        case 'node':
                            set({ streamingStep: event.name, streamingText: '', streamingTool: null })
                            break
                        case 'tool':
                            set({ streamingTool: event.name })
                            break
                        case 'error':
                            set({ error: event.detail })
                            break
                        case 'done':
                            set((s) => ({
                                messages: [...s.messages, botMessage(event.thread_id, event.answer)],
                            }))
                            break
                    }
                },
                controller.signal,
            )
            if (!stale()) {
                set({ sending: false, streamingText: '', streamingStep: null, streamingTool: null })
            }
            void get().refreshMessages(threadId)
        } catch (err: unknown) {
            const stopped = err instanceof DOMException && err.name === 'AbortError'
            if (stale()) {
                set({ sending: false })
                return
            }
            if (stopped) {
                const partial = get().streamingText
                set((s) => ({
                    sending: false,
                    streamingText: '',
                    streamingStep: null,
                    streamingTool: null,
                    messages: partial ? [...s.messages, botMessage(threadId, partial)] : s.messages,
                }))
                window.setTimeout(() => void get().refreshMessages(threadId), SAVE_SETTLE_MS)
                return
            }
            const message = err instanceof Error ? err.message : 'Failed to save the edit'
            set({ sending: false, error: message, streamingText: '', streamingStep: null, streamingTool: null })
        } finally {
            if (activeStream === controller) activeStream = null
        }
    },

    stopStreaming: () => {
        activeStream?.abort()
    },
}))
