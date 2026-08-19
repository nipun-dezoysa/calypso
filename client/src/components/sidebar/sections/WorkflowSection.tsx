import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import {
    IoRefreshOutline,
    IoAlertCircleOutline,
    IoEllipsisVertical,
    IoSearchOutline,
} from 'react-icons/io5'
import CollapsibleSection from '../../common/CollapsibleSection'
import { Input } from '../../ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../ui/alert-dialog'
import {
    listWorkflows,
    createWorkflow,
    deleteWorkflow,
    renameWorkflow,
    getWorkflow,
    type WorkflowSummary,
} from '../../../api/workflowApi'
import { buildDuplicatePayload } from '../../../utils/duplicateWorkflow'
import { useWorkflowStore } from '../../../stores/WorkflowStore'
import { useMainViewStore } from '../../../stores/MainViewStore'

type LoadState = 'idle' | 'loading' | 'error'

function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.round(diffMs / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
}

function WorkflowSection() {
    const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [query, setQuery] = useState('')
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(null)
    const [deleting, setDeleting] = useState(false)
    const renameInputRef = useRef<HTMLInputElement>(null)
    const suppressMenuCloseFocusRef = useRef(false)

    const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId)
    const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow)
    const showWorkflow = useMainViewStore((s) => s.showWorkflow)

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

    useEffect(() => {
        if (!renamingId) return
        // Deferred a tick: Radix's dropdown finishes its own unmount/focus
        // cleanup asynchronously, and it runs after a synchronous focus()
        // call here, stealing it back.
        const id = requestAnimationFrame(() => renameInputRef.current?.focus())
        return () => cancelAnimationFrame(id)
    }, [renamingId])

    const filteredWorkflows = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return workflows
        return workflows.filter((w) => w.name.toLowerCase().includes(q))
    }, [workflows, query])

    async function handleCreate() {
        setCreating(true)
        try {
            const wf = await createWorkflow({ name: 'Untitled Workflow' })
            setWorkflows((prev) => [
                { id: wf.id, name: wf.name, node_count: 0, created_at: wf.created_at, updated_at: wf.updated_at },
                ...prev,
            ])
            showWorkflow()
            selectWorkflow(wf.id)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to create workflow')
        } finally {
            setCreating(false)
        }
    }

    function startRename(wf: WorkflowSummary) {
        // Radix returns focus to the dropdown trigger when it closes, which
        // otherwise races the input's own autofocus effect below.
        suppressMenuCloseFocusRef.current = true
        setRenamingId(wf.id)
        setRenameValue(wf.name)
    }

    async function commitRename(wf: WorkflowSummary) {
        const name = renameValue.trim()
        setRenamingId(null)
        if (!name || name === wf.name) return

        const previous = workflows
        setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? { ...w, name } : w)))
        try {
            await renameWorkflow(wf.id, name)
        } catch (err: unknown) {
            setWorkflows(previous)
            toast.error(err instanceof Error ? err.message : 'Failed to rename workflow')
        }
    }

    async function handleDuplicate(wf: WorkflowSummary) {
        try {
            const full = await getWorkflow(wf.id)
            const payload = buildDuplicatePayload(full, `${full.name} (copy)`)
            const created = await createWorkflow(payload)
            setWorkflows((prev) => [
                {
                    id: created.id,
                    name: created.name,
                    node_count: created.nodes.length,
                    created_at: created.created_at,
                    updated_at: created.updated_at,
                },
                ...prev,
            ])
            toast.success(`Duplicated "${wf.name}"`)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to duplicate workflow')
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return
        const wf = deleteTarget
        setDeleting(true)
        setWorkflows((prev) => prev.filter((w) => w.id !== wf.id))
        if (selectedWorkflowId === wf.id) selectWorkflow(null)
        try {
            await deleteWorkflow(wf.id)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : `Failed to delete "${wf.name}"`)
            fetchWorkflows()
        } finally {
            setDeleting(false)
            setDeleteTarget(null)
        }
    }

    function renderList() {
        if (loadState === 'loading' && workflows.length === 0) {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading workflows…
                </div>
            )
        }
        if (loadState === 'error' && workflows.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-(--c-danger-text) text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-(--c-text-dim) hover:text-(--c-accent-hi) flex items-center gap-1"
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
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No workflows yet.
                </div>
            )
        }
        if (filteredWorkflows.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No workflows match "{query}".
                </div>
            )
        }
        return (
            <div className="py-1">
                {filteredWorkflows.map((wf) => (
                    <div
                        key={wf.id}
                        className="sidebar-item flex items-center justify-between group"
                        onClick={() => {
                            if (renamingId === wf.id) return
                            showWorkflow()
                            selectWorkflow(wf.id)
                        }}
                    >
                        <div className="flex flex-col min-w-0 flex-1">
                            {renamingId === wf.id ? (
                                <Input
                                    ref={renameInputRef}
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() => commitRename(wf)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); commitRename(wf) }
                                        if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                                    }}
                                    className="h-6 text-xs px-1.5 py-0"
                                    maxLength={100}
                                />
                            ) : (
                                <span className={`truncate ${wf.id === selectedWorkflowId ? 'text-(--c-accent-hi)' : ''}`}>
                                    {wf.name}
                                </span>
                            )}
                            <span className="text-[10px] text-(--c-text-subtle)">
                                {wf.node_count} node{wf.node_count === 1 ? '' : 's'} · updated {formatRelativeTime(wf.updated_at)}
                            </span>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-text) p-0.5 shrink-0 outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                    title={`${wf.name} actions`}
                                    aria-label={`${wf.name} actions`}
                                >
                                    <IoEllipsisVertical size={13} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                                onCloseAutoFocus={(e) => {
                                    if (suppressMenuCloseFocusRef.current) {
                                        e.preventDefault()
                                        suppressMenuCloseFocusRef.current = false
                                    }
                                }}
                            >
                                <DropdownMenuItem onSelect={() => startRename(wf)}>
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDuplicate(wf)}>
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setDeleteTarget(wf)}
                                >
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                {workflows.length > 0 && (
                    <div className="px-2 pt-1 pb-1.5 relative">
                        <IoSearchOutline className="absolute left-4.5 top-1/2 -translate-y-1/2 text-(--c-text-subtle) pointer-events-none" size={12} />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search workflows…"
                            className="h-6.5 text-xs pl-6"
                        />
                    </div>
                )}
                {renderList()}
            </CollapsibleSection>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget && (
                                <>"{deleteTarget.name}" will be permanently deleted. This can't be undone.</>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(e) => { e.preventDefault(); confirmDelete() }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default WorkflowSection
