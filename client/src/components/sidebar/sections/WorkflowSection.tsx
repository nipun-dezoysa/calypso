import { useState, useEffect, useCallback } from 'react'
import { IoRefreshOutline, IoAlertCircleOutline, IoTrashOutline } from 'react-icons/io5'
import CollapsibleSection from '../../common/CollapsibleSection'
import {
    listWorkflows,
    createWorkflow,
    deleteWorkflow,
    type WorkflowSummary,
} from '../../../api/workflowApi'
import { useWorkflowStore } from '../../../stores/WorkflowStore'

type LoadState = 'idle' | 'loading' | 'error'

function WorkflowSection() {
    const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)

    const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId)
    const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow)

    const fetchWorkflows = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const data = await listWorkflows({ limit: 100 })
            setWorkflows(data)
            setLoadState('idle')
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load workflows')
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchWorkflows()
    }, [fetchWorkflows])

    async function handleCreate() {
        setCreating(true)
        try {
            const wf = await createWorkflow({ name: 'Untitled Workflow' })
            setWorkflows((prev) => [
                { id: wf.id, name: wf.name, node_count: 0, created_at: wf.created_at, updated_at: wf.updated_at },
                ...prev,
            ])
            selectWorkflow(wf.id)
        } catch {
            // Non-fatal: the list just won't gain a row.
        } finally {
            setCreating(false)
        }
    }

    async function handleDelete(id: string) {
        setWorkflows((prev) => prev.filter((w) => w.id !== id))
        if (selectedWorkflowId === id) selectWorkflow(null)
        try {
            await deleteWorkflow(id)
        } catch {
            fetchWorkflows()
        }
    }

    function renderList() {
        if (loadState === 'loading' && workflows.length === 0) {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading workflows…
                </div>
            )
        }
        if (loadState === 'error' && workflows.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-red-400 text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-zinc-400 hover:text-amber-400 flex items-center gap-1"
                        onClick={fetchWorkflows}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }
        if (workflows.length === 0) {
            return (
                <div className="py-3 px-6 text-zinc-500 text-xs italic">
                    No workflows yet.
                </div>
            )
        }
        return (
            <div className="py-1">
                {workflows.map((wf) => (
                    <div
                        key={wf.id}
                        className="sidebar-item flex items-center justify-between group"
                        onClick={() => selectWorkflow(wf.id)}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className={`truncate ${wf.id === selectedWorkflowId ? 'text-amber-400' : ''}`}>
                                {wf.name}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                                {wf.node_count} node{wf.node_count === 1 ? '' : 's'}
                            </span>
                        </div>
                        <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 p-0.5 shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDelete(wf.id) }}
                            title={`Delete ${wf.name}`}
                            aria-label={`Delete ${wf.name}`}
                        >
                            <IoTrashOutline size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            <CollapsibleSection
                title="Workflows"
                action={{ label: creating ? '…' : '+ New', onClick: handleCreate }}
            >
                {renderList()}
            </CollapsibleSection>
        </div>
    )
}

export default WorkflowSection
