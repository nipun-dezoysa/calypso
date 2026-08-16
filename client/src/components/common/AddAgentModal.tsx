import { useEffect, useState } from 'react'
import { IoAdd, IoAlertCircleOutline } from 'react-icons/io5'
import Modal from './Modal'
import AgentFormFields from './AgentFormFields'
import { useAgentForm } from './useAgentForm'
import { listAIProviders, type AIProvider } from '../../api/aiProviderApi'
import { listCollections, type Collection } from '../../api/kbApi'
import { listMcpServers, type McpServer } from '../../api/mcpApi'

export interface NewAgentPayload {
    name: string
    llm_model_id: string
    agent_instructions: string
    creativity: number
    markdown_enabled: boolean
    collection_ids: string[]
    mcp_server_ids: string[]
}

interface AddAgentModalProps {
    onClose: () => void
    onSubmit: (payload: NewAgentPayload) => Promise<void>
}

function AddAgentModal({ onClose, onSubmit }: AddAgentModalProps) {
    const form = useAgentForm()
    const [submitting, setSubmitting] = useState(false)

    const [providers, setProviders] = useState<AIProvider[]>([])
    const [collections, setCollections] = useState<Collection[]>([])
    const [mcpServers, setMcpServers] = useState<McpServer[]>([])
    const [loadingProviders, setLoadingProviders] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        Promise.all([
            listAIProviders({ limit: 100 }),
            listCollections({ limit: 100 }),
            listMcpServers({ limit: 100 }),
        ])
            .then(([providerData, collectionData, mcpData]) => {
                if (cancelled) return
                setProviders(providerData)
                setCollections(collectionData)
                setMcpServers(mcpData)
            })
            .catch((err: unknown) => {
                if (cancelled) return
                setLoadError(err instanceof Error ? err.message : 'Failed to load providers')
            })
            .finally(() => { if (!cancelled) setLoadingProviders(false) })
        return () => { cancelled = true }
    }, [])

    async function handleSubmit() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            await onSubmit(form.formValues)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to add agent'
            form.setErrors((prev) => ({ ...prev, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            title="Add Agent"
            subtitle="Configure a new agentic assistant"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn--cancel" onClick={onClose} type="button">
                        Cancel
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSubmit}
                        disabled={submitting || loadingProviders}
                        type="button"
                    >
                        {submitting ? (
                            <><span className="ui-spinner" /> Adding…</>
                        ) : (
                            <><IoAdd style={{ fontSize: 16 }} /> Add Agent</>
                        )}
                    </button>
                </>
            }
        >
            {form.errors._global && (
                <div className="form-error form-error--banner">{form.errors._global}</div>
            )}

            {loadError && (
                <div className="form-error form-error--banner">
                    <IoAlertCircleOutline style={{ marginRight: 4 }} />
                    {loadError}
                </div>
            )}

            {loadingProviders ? (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="apm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Loading providers…
                </div>
            ) : (
                <AgentFormFields form={form} providers={providers} collections={collections} mcpServers={mcpServers} />
            )}
        </Modal>
    )
}

export default AddAgentModal
