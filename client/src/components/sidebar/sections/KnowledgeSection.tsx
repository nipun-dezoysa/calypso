import { useState, useEffect, useCallback } from 'react'
import { IoRefreshOutline, IoAlertCircleOutline } from 'react-icons/io5'
import CollapsibleSection from '../../common/CollapsibleSection'
import CreateCollectionModal from '../../common/CreateCollectionModal'
import ManageCollectionModal from '../../common/ManageCollectionModal'
import { Badge } from '../../ui/badge'
import { listCollections, type Collection } from '../../../api/kbApi'

type LoadState = 'idle' | 'loading' | 'error'

function KnowledgeSection() {
    const [collections, setCollections] = useState<Collection[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)

    const [showCreate, setShowCreate] = useState(false)
    const [managing, setManaging] = useState<Collection | null>(null)

    const fetchCollections = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const data = await listCollections({ limit: 100 })
            setCollections(data)
            setLoadState('idle')
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load knowledgebases')
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchCollections()
    }, [fetchCollections])

    function handleCreated(collection: Collection) {
        setCollections((prev) => [collection, ...prev])
    }

    function handleUpdated(updated: Collection) {
        setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        // Keep the open manage modal's header/counts fresh.
        setManaging((cur) => (cur && cur.id === updated.id ? updated : cur))
    }

    function handleDeleted(id: string) {
        setCollections((prev) => prev.filter((c) => c.id !== id))
    }

    function renderList() {
        if (loadState === 'loading' && collections.length === 0) {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading knowledgebases…
                </div>
            )
        }

        if (loadState === 'error' && collections.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-(--c-danger-text) text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-(--c-text-dim) hover:text-(--c-accent-hi) flex items-center gap-1"
                        onClick={fetchCollections}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }

        if (collections.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No knowledgebases yet.
                </div>
            )
        }

        return (
            <div className="py-1">
                {collections.map((kb) => (
                    <div
                        key={kb.id}
                        className="sidebar-item flex justify-between items-center"
                        onClick={() => setManaging(kb)}
                        title={kb.description ?? kb.name}
                    >
                        <span className="truncate">{kb.name}</span>
                        <Badge variant="secondary" className="rounded-full font-mono text-[10px] px-1.5 py-0.5">
                            {kb.document_count}
                        </Badge>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            <CollapsibleSection
                title="Knowledgebases"
                action={{ label: '+ New', onClick: () => setShowCreate(true) }}
            >
                {renderList()}
            </CollapsibleSection>

            {showCreate && (
                <CreateCollectionModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}

            {managing && (
                <ManageCollectionModal
                    collection={managing}
                    onClose={() => setManaging(null)}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            )}
        </div>
    )
}

export default KnowledgeSection
