import { useState, useEffect, useCallback } from 'react'
import { IoRefreshOutline, IoAlertCircleOutline, IoPencilOutline } from 'react-icons/io5'
import CollapsibleSection from '../../common/CollapsibleSection'
import AddMcpServerModal from '../../common/AddMcpServerModal'
import EditMcpServerModal from '../../common/EditMcpServerModal'
import { listMcpServers, type McpServer } from '../../../api/mcpApi'

type LoadState = 'idle' | 'loading' | 'error'

function McpSection() {
    const [servers, setServers] = useState<McpServer[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState<McpServer | null>(null)

    const fetchServers = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const data = await listMcpServers({ limit: 100 })
            setServers(data)
            setLoadState('idle')
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load MCP servers')
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchServers()
    }, [fetchServers])

    function handleCreated(server: McpServer) {
        setServers((prev) => [server, ...prev])
    }

    function handleUpdated(updated: McpServer) {
        setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    }

    function handleDeleted(id: string) {
        setServers((prev) => prev.filter((s) => s.id !== id))
    }

    function renderList() {
        if (loadState === 'loading' && servers.length === 0) {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading servers…
                </div>
            )
        }

        if (loadState === 'error' && servers.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-(--c-danger-text) text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-(--c-text-dim) hover:text-(--c-accent-hi) flex items-center gap-1"
                        onClick={fetchServers}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }

        if (servers.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No MCP servers configured yet.
                </div>
            )
        }

        return (
            <div className="py-1">
                {servers.map((server) => (
                    <div
                        key={server.id}
                        className="sidebar-item flex items-center justify-between group"
                        onClick={() => setEditing(server)}
                        title={server.description ?? server.name}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="truncate">{server.name}</span>
                            <span className="text-[10px] text-(--c-text-subtle) truncate">
                                {server.transport}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span
                                className={`w-2 h-2 rounded-full ${server.enabled ? 'bg-(--c-success)' : 'bg-(--c-text-subtle)'}`}
                                title={server.enabled ? 'Enabled' : 'Disabled'}
                            />
                            <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-accent-hi) p-0.5"
                                onClick={(e) => { e.stopPropagation(); setEditing(server) }}
                                title={`Edit ${server.name}`}
                                aria-label={`Edit ${server.name}`}
                            >
                                <IoPencilOutline size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            <CollapsibleSection
                title="MCP Servers"
                action={{ label: '+ Add', onClick: () => setShowAdd(true) }}
            >
                {renderList()}
            </CollapsibleSection>

            {showAdd && (
                <AddMcpServerModal
                    onClose={() => setShowAdd(false)}
                    onCreated={handleCreated}
                />
            )}

            {editing && (
                <EditMcpServerModal
                    server={editing}
                    onClose={() => setEditing(null)}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            )}
        </div>
    )
}

export default McpSection
