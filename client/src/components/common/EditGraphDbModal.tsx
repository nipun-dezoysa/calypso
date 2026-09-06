import { useState } from 'react'
import {
    IoAdd,
    IoTrashOutline,
    IoFlashOutline,
    IoCheckmarkCircle,
    IoAlertCircle,
} from 'react-icons/io5'
import Modal from './Modal'
import ConfirmDeleteDialog from './ConfirmDeleteDialog'
import GraphDbFormFields from './GraphDbFormFields'
import GraphSchemaPreview from './GraphSchemaPreview'
import { useGraphDbForm } from './useGraphDbForm'
import {
    updateGraphDb,
    deleteGraphDb,
    testGraphDb,
    type GraphDb,
    type GraphDbTestResult,
} from '../../api/graphDbApi'
import './ui.css'
import './mcp.css'
import './graph.css'

interface EditGraphDbModalProps {
    graphDb: GraphDb
    onClose: () => void
    onUpdated: (updated: GraphDb) => void
    onDeleted: (id: string) => void
}

function EditGraphDbModal({ graphDb, onClose, onUpdated, onDeleted }: EditGraphDbModalProps) {
    const form = useGraphDbForm(graphDb)

    const [submitting, setSubmitting] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<GraphDbTestResult | null>(null)

    async function handleSave() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            const updated = await updateGraphDb(graphDb.id, form.updateValues)
            onUpdated(updated)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update graph database'
            form.setErrors((p) => ({ ...p, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    async function handleTest() {
        setTesting(true)
        setTestResult(null)
        try {
            setTestResult(await testGraphDb(graphDb.id))
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Test request failed'
            setTestResult({
                ok: false,
                node_label_count: 0,
                relationship_type_count: 0,
                graph_schema: null,
                error: msg,
            })
        } finally {
            setTesting(false)
        }
    }

    async function handleConfirmDelete() {
        setDeleting(true)
        try {
            await deleteGraphDb(graphDb.id)
            onDeleted(graphDb.id)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete graph database'
            form.setErrors((p) => ({ ...p, _global: msg }))
            setConfirmingDelete(false)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Modal
            title="Edit Graph Database"
            subtitle={graphDb.name}
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn--cancel" onClick={onClose} type="button">
                        Cancel
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSave}
                        disabled={submitting}
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
            <ConfirmDeleteDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title="Delete Graph Database?"
                description={<>This will permanently remove <strong>{graphDb.name}</strong> and detach it from every agent using it. The database itself is not touched.</>}
                onConfirm={handleConfirmDelete}
                deleting={deleting}
                confirmLabel="Yes, Delete"
            />

            {form.errors._global && (
                <div className="form-error form-error--banner">{form.errors._global}</div>
            )}

            <GraphDbFormFields form={form} />

            {/* ── Test connection ── */}
            <div className="mcp-test-row">
                <button
                    className="btn--ghost"
                    onClick={handleTest}
                    disabled={testing}
                    type="button"
                >
                    {testing ? (
                        <><span className="ui-spinner" /> Testing…</>
                    ) : (
                        <><IoFlashOutline /> Test Connection</>
                    )}
                </button>
                <span className="mcp-test-hint">
                    Connects and reads the schema, using the saved settings.
                </span>
            </div>

            {testResult && (
                testResult.ok ? (
                    <div className="mcp-test-result mcp-test-result--ok">
                        <div className="mcp-test-result__head">
                            <IoCheckmarkCircle />
                            Connected · {testResult.node_label_count} label
                            {testResult.node_label_count === 1 ? '' : 's'} ·{' '}
                            {testResult.relationship_type_count} relationship type
                            {testResult.relationship_type_count === 1 ? '' : 's'}
                        </div>
                        {testResult.graph_schema && (
                            <GraphSchemaPreview schema={testResult.graph_schema} />
                        )}
                    </div>
                ) : (
                    <div className="mcp-test-result mcp-test-result--err">
                        <div className="mcp-test-result__head">
                            <IoAlertCircle />
                            Connection failed
                        </div>
                        <div className="mcp-test-result__msg">{testResult.error}</div>
                    </div>
                )
            )}

            <hr className="ui-divider" />
            <div className="danger-zone">
                <div className="danger-zone__label">
                    <span className="danger-zone__title">Delete Database</span>
                    <span className="danger-zone__desc">
                        Removes the connection from Calypso. The graph itself is left alone.
                    </span>
                </div>
                <button className="btn--danger" onClick={() => setConfirmingDelete(true)} type="button">
                    <IoTrashOutline size={13} /> Delete
                </button>
            </div>
        </Modal>
    )
}

export default EditGraphDbModal
