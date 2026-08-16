import { useEffect, useState } from 'react'
import { IoAdd, IoAlertCircleOutline, IoTrashOutline, IoWarningOutline } from 'react-icons/io5'
import Modal from './Modal'
import AgentFormFields from './AgentFormFields'
import { useAgentForm } from './useAgentForm'
import { updateAgent, deleteAgent, type Agent } from '../../api/agentApi'
import { listAIProviders, type AIProvider } from '../../api/aiProviderApi'
import { listCollections, type Collection } from '../../api/kbApi'
import { listMcpServers, type McpServer } from '../../api/mcpApi'
import './ui.css'

interface EditAgentModalProps {
    agent: Agent
    onClose: () => void
    onUpdated: (updated: Agent) => void
    onDeleted: (id: string) => void
}

function EditAgentModal({ agent, onClose, onUpdated, onDeleted }: EditAgentModalProps) {
    const form = useAgentForm({
        initialName: agent.name,
        initialLlmModelId: agent.llm_model_id,
        initialAgentInstructions: agent.agent_instructions,
        initialCreativity: agent.creativity,
        initialCollectionIds: agent.collections.map((c) => c.id),
        initialMcpServerIds: agent.mcp_servers.map((s) => s.id),
    })

    const [submitting, setSubmitting] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

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

    async function handleSave() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            const updated = await updateAgent(agent.id, form.formValues)
            onUpdated(updated)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update agent'
            form.setErrors((p) => ({ ...p, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    async function handleConfirmDelete() {
        setDeleting(true)
        try {
            await deleteAgent(agent.id)
            onDeleted(agent.id)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete agent'
            form.setErrors((p) => ({ ...p, _global: msg }))
            setConfirmingDelete(false)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Modal
            title={<>Edit Agent</>}
            onClose={onClose}
            onEscape={() => confirmingDelete ? setConfirmingDelete(false) : onClose()}
            footer={
                <>
                    <button className="btn btn--cancel" onClick={onClose} type="button">
                        Cancel
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSave}
                        disabled={submitting || loadingProviders}
                        type="button"
                    >
                        {submitting ? (
                            <><span className="ui-spinner" /> Saving…</>
                        ) : (
                            <><IoAdd style={{ fontSize: 16 }} /> Save Changes</>
                        )}
                    </button>
                </>
            }
        >
            {confirmingDelete && (
                <div className="confirm-overlay">
                    <div className="confirm-overlay__icon"><IoWarningOutline /></div>
                    <p className="confirm-overlay__heading">Delete Agent?</p>
                    <p className="confirm-overlay__body">
                        This will permanently remove{' '}
                        <span className="confirm-overlay__name">{agent.name}</span>.
                        This cannot be undone.
                    </p>
                    <div className="confirm-overlay__actions">
                        <button
                            className="btn btn--cancel"
                            onClick={() => setConfirmingDelete(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn--confirm-delete"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <><span className="ui-spinner" /> Deleting…</>
                            ) : (
                                <><IoTrashOutline /> Yes, Delete</>
                            )}
                        </button>
                    </div>
                </div>
            )}

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

            <hr className="ui-divider" />
            <div className="danger-zone">
                <div className="danger-zone__label">
                    <span className="danger-zone__title">Delete Agent</span>
                    <span className="danger-zone__desc">Permanently removes this agent.</span>
                </div>
                <button className="btn--danger" onClick={() => setConfirmingDelete(true)} type="button">
                    <IoTrashOutline size={13} /> Delete
                </button>
            </div>
        </Modal>
    )
}

export default EditAgentModal
