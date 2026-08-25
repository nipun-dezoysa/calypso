import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import CollapsibleSection from '../../common/CollapsibleSection'
import AddAgentModal, { type NewAgentPayload } from '../../common/AddAgentModal'
import EditAgentModal from '../../common/EditAgentModal'
import ConfirmDeleteDialog from '../../common/ConfirmDeleteDialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { listAgents, createAgent, type Agent } from '../../../api/agentApi'
import { listWorkflows, type WorkflowSummary } from '../../../api/workflowApi'
import type { ChatThread } from '../../../api/chatApi'
import {
    IoRefreshOutline,
    IoAlertCircleOutline,
    IoGitNetworkOutline,
    IoTrashOutline,
    IoEllipsisVertical,
} from 'react-icons/io5'
import { notifyTour } from '../../../tour/tourEvents'
import { useChatStore } from '../../../stores/ChatStore'
import { useMainViewStore } from '../../../stores/MainViewStore'

type LoadState = 'idle' | 'loading' | 'error'

function AgentSection() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
    const [deleteThreadTarget, setDeleteThreadTarget] = useState<ChatThread | null>(null)
    const [deletingThread, setDeletingThread] = useState(false)

    const targetId = useChatStore((s) => s.targetId)
    const targetType = useChatStore((s) => s.targetType)
    const threads = useChatStore((s) => s.threads)
    const activeThreadId = useChatStore((s) => s.threadId)
    const openThread = useChatStore((s) => s.openThread)
    const newChat = useChatStore((s) => s.newChat)
    const removeThread = useChatStore((s) => s.removeThread)
    const selectAgent = useChatStore((s) => s.selectAgent)
    const selectWorkflow = useChatStore((s) => s.selectWorkflow)
    const showChat = useMainViewStore((s) => s.showChat)

    const fetchAll = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const [agentData, workflowData] = await Promise.all([
                listAgents({ limit: 100 }),
                listWorkflows({ limit: 100 }),
            ])
            setAgents(agentData)
            setWorkflows(workflowData)
            setLoadState('idle')
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load')
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchAll()
    }, [fetchAll])

    async function handleAddAgent(payload: NewAgentPayload): Promise<void> {
        try {
            const created = await createAgent(payload)
            setAgents((prev) => [created, ...prev])
            notifyTour('agent.created')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to add agent')
            throw err
        }
    }

    function handleAgentUpdated(updated: Agent) {
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    }

    function handleAgentDeleted(id: string) {
        setAgents((prev) => prev.filter((a) => a.id !== id))
        if (targetType === 'agent' && targetId === id) selectAgent(null)
    }

    function formatThreadTitle(title: string | null, updatedAt: string): string {
        return title ?? new Date(updatedAt).toLocaleString()
    }

    async function confirmDeleteThread() {
        if (!deleteThreadTarget) return
        const thread = deleteThreadTarget
        setDeletingThread(true)
        await removeThread(thread.id)
        const failure = useChatStore.getState().error
        setDeletingThread(false)
        setDeleteThreadTarget(null)
        if (failure) {
            toast.error(failure)
        }
    }

    function renderThreadList() {
        if (!targetId) {
            return (
                <div className="sidebar-item sidebar-item--empty">
                    Select an agent or workflow to see its chats
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
                        className="sidebar-item flex items-center justify-between gap-1 group"
                        onClick={() => { showChat(); openThread(thread.id) }}
                        title={formatThreadTitle(thread.title, thread.updated_at)}
                    >
                        <span className={`truncate ${thread.id === activeThreadId ? 'text-(--c-accent-hi)' : ''}`}>
                            {formatThreadTitle(thread.title, thread.updated_at)}
                        </span>
                        <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-danger-text) p-0.5 shrink-0"
                            onClick={(e) => { e.stopPropagation(); setDeleteThreadTarget(thread) }}
                            title="Delete chat"
                            aria-label={`Delete chat ${formatThreadTitle(thread.title, thread.updated_at)}`}
                        >
                            <IoTrashOutline size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )
    }

    function renderAgentList() {
        if (loadState === 'loading') {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading agents…
                </div>
            )
        }

        if (loadState === 'error' && agents.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-(--c-danger-text) text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-(--c-text-dim) hover:text-(--c-accent-hi) flex items-center gap-1"
                        onClick={fetchAll}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }

        if (agents.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
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
                        onClick={() => { showChat(); selectAgent(agent) }}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className={`truncate ${targetType === 'agent' && agent.id === targetId ? 'text-(--c-accent-hi)' : ''}`}>
                                {agent.name}
                            </span>
                            <span className="text-[10px] text-(--c-text-subtle) truncate">
                                {agent.llm_model.provider_name} · {agent.llm_model.model_name}
                            </span>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-text) p-0.5 shrink-0 outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                    title={`${agent.name} actions`}
                                    aria-label={`${agent.name} actions`}
                                >
                                    <IoEllipsisVertical size={13} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onSelect={() => setEditingAgent(agent)}>
                                    Edit
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </div>
        )
    }

    function renderWorkflowList() {
        if (workflows.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No workflows yet.
                </div>
            )
        }
        return (
            <div className="py-1">
                {workflows.map((wf) => (
                    <div
                        key={wf.id}
                        className="sidebar-item flex items-center gap-2"
                        onClick={() => { showChat(); selectWorkflow({ id: wf.id, name: wf.name }) }}
                    >
                        <IoGitNetworkOutline size={13} className="shrink-0 text-(--c-text-subtle)" />
                        <span className={`truncate ${targetType === 'workflow' && wf.id === targetId ? 'text-(--c-accent-hi)' : ''}`}>
                            {wf.name}
                        </span>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            <CollapsibleSection
                title="Agents"
                tourId="agent-list"
                action={{
                    label: '+ New',
                    onClick: () => setShowAddModal(true),
                    tourId: 'agent-add',
                }}
            >
                {renderAgentList()}
            </CollapsibleSection>

            <CollapsibleSection title="Workflows" tourId="agent-workflow-list">
                {renderWorkflowList()}
            </CollapsibleSection>

            <CollapsibleSection
                title="Recent Chats"
                tourId="chat-threads"
                action={targetId ? { label: '+ New', onClick: () => { showChat(); newChat() } } : undefined}
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

            <ConfirmDeleteDialog
                open={!!deleteThreadTarget}
                onOpenChange={(open) => !open && setDeleteThreadTarget(null)}
                title="Delete chat?"
                description={
                    deleteThreadTarget && (
                        <>"{formatThreadTitle(deleteThreadTarget.title, deleteThreadTarget.updated_at)}" will be permanently deleted. This can't be undone.</>
                    )
                }
                onConfirm={confirmDeleteThread}
                deleting={deletingThread}
            />
        </div>
    )
}

export default AgentSection
