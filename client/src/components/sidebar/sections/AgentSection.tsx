import { useState, useEffect, useCallback } from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'
import AddAgentModal, { type NewAgentPayload } from '../../common/AddAgentModal'
import EditAgentModal from '../../common/EditAgentModal'
import { listAgents, createAgent, type Agent } from '../../../api/agentApi'
import { IoRefreshOutline, IoAlertCircleOutline, IoPencilOutline } from 'react-icons/io5'
import { useChatStore } from '../../../stores/ChatStore'

type LoadState = 'idle' | 'loading' | 'error'

function AgentSection() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

    const selectedAgent = useChatStore((s) => s.selectedAgent)
    const threads = useChatStore((s) => s.threads)
    const activeThreadId = useChatStore((s) => s.threadId)
    const openThread = useChatStore((s) => s.openThread)
    const newChat = useChatStore((s) => s.newChat)
    const selectAgent = useChatStore((s) => s.selectAgent)

    const fetchAgents = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const data = await listAgents({ limit: 100 })
            setAgents(data)
            setLoadState('idle')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load agents'
            setLoadError(message)
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchAgents()
    }, [fetchAgents])

    async function handleAddAgent(payload: NewAgentPayload): Promise<void> {
        const created = await createAgent(payload)
        setAgents((prev) => [created, ...prev])
    }

    function handleAgentUpdated(updated: Agent) {
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    }

    function handleAgentDeleted(id: string) {
        setAgents((prev) => prev.filter((a) => a.id !== id))
        if (selectedAgent?.id === id) selectAgent(null)
    }

    function formatThreadTitle(title: string | null, updatedAt: string): string {
        return title ?? new Date(updatedAt).toLocaleString()
    }

    function renderThreadList() {
        if (!selectedAgent) {
            return (
                <div className="sidebar-item sidebar-item--empty">
                    Select an agent to see its chats
                </div>
            )
        }

        if (threads.length === 0) {
            return (
                <div className="sidebar-item sidebar-item--empty">
                    No recent chats
                </div>
            )
        }

        return (
            <div className="py-1">
                {threads.map((thread) => (
                    <div
                        key={thread.id}
                        className={`sidebar-item truncate ${thread.id === activeThreadId ? 'text-amber-400' : ''}`}
                        onClick={() => openThread(thread.id)}
                        title={formatThreadTitle(thread.title, thread.updated_at)}
                    >
                        {formatThreadTitle(thread.title, thread.updated_at)}
                    </div>
                ))}
            </div>
        )
    }

    function renderAgentList() {
        if (loadState === 'loading') {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading agents…
                </div>
            )
        }

        if (loadState === 'error' && agents.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-red-400 text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-zinc-400 hover:text-amber-400 flex items-center gap-1"
                        onClick={fetchAgents}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }

        if (agents.length === 0) {
            return (
                <div className="py-3 px-6 text-zinc-500 text-xs italic">
                    No agents configured yet.
                </div>
            )
        }

        return (
            <div className="py-1">
                {agents.map((agent) => (
                    <div
                        key={agent.id}
                        className="sidebar-item flex items-center justify-between group"
                        onClick={() => selectAgent(agent)}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className={`truncate ${agent.id === selectedAgent?.id ? 'text-amber-400' : ''}`}>
                                {agent.name}
                            </span>
                            <span className="text-[10px] text-zinc-600 truncate">
                                {agent.llm_model.provider_name} · {agent.llm_model.model_name}
                            </span>
                        </div>
                        <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-amber-400 p-0.5 shrink-0"
                            onClick={(e) => { e.stopPropagation(); setEditingAgent(agent) }}
                            title={`Edit ${agent.name}`}
                            aria-label={`Edit ${agent.name}`}
                        >
                            <IoPencilOutline size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>

            <CollapsibleSection
                title="Agents"
                action={{ label: '+ New', onClick: () => setShowAddModal(true) }}
            >
                {renderAgentList()}
            </CollapsibleSection>

            <CollapsibleSection
                title="Recent Chats"
                action={selectedAgent ? { label: '+ New', onClick: newChat } : undefined}
            >
                {renderThreadList()}
            </CollapsibleSection>

            {showAddModal && (
                <AddAgentModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddAgent}
                />
            )}

            {editingAgent && (
                <EditAgentModal
                    agent={editingAgent}
                    onClose={() => setEditingAgent(null)}
                    onUpdated={handleAgentUpdated}
                    onDeleted={handleAgentDeleted}
                />
            )}
        </div>
    )
}

export default AgentSection
