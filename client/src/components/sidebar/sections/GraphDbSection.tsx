import { useState, useEffect, useCallback } from 'react'
import { IoRefreshOutline, IoAlertCircleOutline } from 'react-icons/io5'
import CollapsibleSection from '../../common/CollapsibleSection'
import AddGraphDbModal from '../../common/AddGraphDbModal'
import EditGraphDbModal from '../../common/EditGraphDbModal'
import { Badge } from '../../ui/badge'
import { listGraphDbs, type GraphDb } from '../../../api/graphDbApi'
import '../../common/graph.css'

type LoadState = 'idle' | 'loading' | 'error'

/** The host part of a Bolt URI, which is what identifies a row at a glance. */
function hostOf(uri: string): string {
    return uri.replace(/^[a-z+]+:\/\//, '')
}

function GraphDbSection() {
    const [graphDbs, setGraphDbs] = useState<GraphDb[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState<GraphDb | null>(null)

    const fetchGraphDbs = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const data = await listGraphDbs({ limit: 100 })
            setGraphDbs(data)
            setLoadState('idle')
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load graph databases')
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchGraphDbs()
    }, [fetchGraphDbs])

    function handleCreated(graphDb: GraphDb) {
        setGraphDbs((prev) => [graphDb, ...prev])
    }

    function handleUpdated(updated: GraphDb) {
        setGraphDbs((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    }

    function handleDeleted(id: string) {
        setGraphDbs((prev) => prev.filter((g) => g.id !== id))
    }

    function renderList() {
        if (loadState === 'loading' && graphDbs.length === 0) {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading databases…
                </div>
            )
        }

        if (loadState === 'error' && graphDbs.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-(--c-danger-text) text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-(--c-text-dim) hover:text-(--c-accent-hi) flex items-center gap-1"
                        onClick={fetchGraphDbs}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }

        if (graphDbs.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No graph databases configured yet.
                </div>
            )
        }

        return (
            <div className="py-1">
                {graphDbs.map((graphDb) => (
                    <div
                        key={graphDb.id}
                        className="sidebar-item flex items-center justify-between group"
                        onClick={() => setEditing(graphDb)}
                        title={graphDb.description ?? graphDb.uri}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="truncate">{graphDb.name}</span>
                            <span className="graph-row-meta">
                                <span className="text-[10px] text-(--c-text-subtle) truncate">
                                    {hostOf(graphDb.uri)}
                                </span>
                                {graphDb.read_only && (
                                    <span className="graph-row-badge">read-only</span>
                                )}
                            </span>
                        </div>
                        <Badge
                            variant={graphDb.enabled ? 'success' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                            {graphDb.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            <CollapsibleSection
                title="Graph Databases"
                tourId="graphdb-list"
                action={{
                    label: '+ Add',
                    onClick: () => setShowAdd(true),
                    tourId: 'graphdb-add',
                }}
            >
                {renderList()}
            </CollapsibleSection>

            {showAdd && (
                <AddGraphDbModal
                    onClose={() => setShowAdd(false)}
                    onCreated={handleCreated}
                />
            )}

            {editing && (
                <EditGraphDbModal
                    graphDb={editing}
                    onClose={() => setEditing(null)}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            )}
        </div>
    )
}

export default GraphDbSection
