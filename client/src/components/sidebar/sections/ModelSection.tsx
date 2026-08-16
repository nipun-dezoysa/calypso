import { useState, useEffect, useCallback } from 'react'
import { formatTokens } from '../../../data/aiProviderSuggestions'
import CollapsibleSection from '../../common/CollapsibleSection'
import AddProviderModal, { type NewProviderPayload } from '../../common/AddProviderModal'
import EditProviderModal from '../../common/EditProviderModal'
import {
    listAIProviders,
    createAIProvider,
    type AIProvider,
} from '../../../api/aiProviderApi'
import { IoRefreshOutline, IoAlertCircleOutline, IoPencilOutline } from 'react-icons/io5'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadState = 'idle' | 'loading' | 'error'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ModelSection() {
    const [providers, setProviders] = useState<AIProvider[]>([])
    const [loadState, setLoadState] = useState<LoadState>('idle')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)

    // -----------------------------------------------------------------------
    // Fetch providers on mount
    // -----------------------------------------------------------------------

    const fetchProviders = useCallback(async () => {
        setLoadState('loading')
        setLoadError(null)
        try {
            const data = await listAIProviders({ limit: 100 })
            setProviders(data)
            setLoadState('idle')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load providers'
            setLoadError(message)
            setLoadState('error')
        }
    }, [])

    useEffect(() => {
        fetchProviders()
    }, [fetchProviders])

    // -----------------------------------------------------------------------
    // Create provider
    // -----------------------------------------------------------------------

    async function handleAddProvider(payload: NewProviderPayload): Promise<void> {
        const created = await createAIProvider({
            provider_name: payload.provider_name,
            model_names: payload.model_names,
            model_contexts: payload.model_contexts,
            url: payload.url ?? null,
            secret_key: payload.secret_key ?? null,
        })
        setProviders((prev) => [...prev, created])
    }

    // -----------------------------------------------------------------------
    // Update provider (called by EditProviderModal after PATCH succeeds)
    // -----------------------------------------------------------------------

    function handleProviderUpdated(updated: AIProvider) {
        setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    }

    // -----------------------------------------------------------------------
    // Delete provider (called by EditProviderModal after DELETE succeeds)
    // -----------------------------------------------------------------------

    function handleProviderDeleted(id: string) {
        setProviders((prev) => prev.filter((p) => p.id !== id))
    }

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------

    function renderProviderList() {
        if (loadState === 'loading') {
            return (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading providers…
                </div>
            )
        }

        if (loadState === 'error' && providers.length === 0) {
            return (
                <div className="py-3 px-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-(--c-danger-text) text-xs">
                        <IoAlertCircleOutline className="shrink-0" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        className="sidebar-item text-(--c-text-dim) hover:text-(--c-accent-hi) flex items-center gap-1"
                        onClick={fetchProviders}
                    >
                        <IoRefreshOutline />
                        Retry
                    </button>
                </div>
            )
        }

        if (providers.length === 0) {
            return (
                <div className="py-3 px-6 text-(--c-text-muted) text-xs italic">
                    No providers configured yet.
                </div>
            )
        }

        return (
            <div className="py-1">
                {providers.map((provider) => (
                    <div key={provider.id} className="mb-3">
                        {/* Provider header row — pencil opens edit modal */}
                        <div className="flex items-center justify-between px-4 mb-1 group">
                            <span className="text-[10px] font-semibold text-(--c-text-subtle) uppercase tracking-wider">
                                {provider.provider_name}
                            </span>
                            <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-accent-hi) p-0.5"
                                onClick={() => setEditingProvider(provider)}
                                title={`Edit ${provider.provider_name}`}
                                aria-label={`Edit ${provider.provider_name}`}
                            >
                                <IoPencilOutline size={12} />
                            </button>
                        </div>

                        {/* Model rows */}
                        {provider.model_names.map((model) => {
                            const context = provider.models.find(
                                (m) => m.model_name === model,
                            )?.context_tokens
                            return (
                                <div
                                    key={model}
                                    className="sidebar-item flex items-center justify-between gap-2"
                                >
                                    <span className="truncate">{model}</span>
                                    <span className="flex items-center gap-2 shrink-0">
                                        {context ? (
                                            <span
                                                className="text-[10px] text-(--c-text-subtle)"
                                                title={`${context.toLocaleString()} token context window`}
                                            >
                                                {formatTokens(context)}
                                            </span>
                                        ) : null}
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-(--c-success)"
                                            title="Active"
                                        />
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        )
    }

    // -----------------------------------------------------------------------
    // JSX
    // -----------------------------------------------------------------------

    return (
        <div>
            <CollapsibleSection
                title="AI Providers"
                action={{
                    label: '+ Add',
                    onClick: () => setShowAddModal(true),
                }}
            >
                {renderProviderList()}
            </CollapsibleSection>

            {/* Add Provider Modal */}
            {showAddModal && (
                <AddProviderModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddProvider}
                />
            )}

            {/* Edit / Delete Provider Modal */}
            {editingProvider && (
                <EditProviderModal
                    provider={editingProvider}
                    onClose={() => setEditingProvider(null)}
                    onUpdated={handleProviderUpdated}
                    onDeleted={handleProviderDeleted}
                />
            )}
        </div>
    )
}

export default ModelSection