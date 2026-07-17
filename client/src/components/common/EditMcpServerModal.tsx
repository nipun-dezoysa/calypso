import { useState } from 'react'
import {
    IoAdd,
    IoTrashOutline,
    IoWarningOutline,
    IoFlashOutline,
    IoCheckmarkCircle,
    IoAlertCircle,
} from 'react-icons/io5'
import Modal from './Modal'
import McpServerFormFields from './McpServerFormFields'
import { useMcpServerForm } from './useMcpServerForm'
import {
    updateMcpServer,
    deleteMcpServer,
    testMcpServer,
    type McpServer,
    type McpTestResult,
} from '../../api/mcpApi'
import './ui.css'
import './mcp.css'

interface EditMcpServerModalProps {
    server: McpServer
    onClose: () => void
    onUpdated: (updated: McpServer) => void
    onDeleted: (id: string) => void
}

function EditMcpServerModal({ server, onClose, onUpdated, onDeleted }: EditMcpServerModalProps) {
    const form = useMcpServerForm(server)

    const [submitting, setSubmitting] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<McpTestResult | null>(null)

    async function handleSave() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            const updated = await updateMcpServer(server.id, form.formValues)
            onUpdated(updated)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update MCP server'
            form.setErrors((p) => ({ ...p, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    async function handleTest() {
        setTesting(true)
        setTestResult(null)
        try {
            setTestResult(await testMcpServer(server.id))
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Test request failed'
            setTestResult({ ok: false, tool_count: 0, tools: [], error: msg })
        } finally {
            setTesting(false)
        }
    }

    async function handleConfirmDelete() {
        setDeleting(true)
        try {
            await deleteMcpServer(server.id)
            onDeleted(server.id)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete MCP server'
            form.setErrors((p) => ({ ...p, _global: msg }))
            setConfirmingDelete(false)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Modal
            title="Edit MCP Server"
            subtitle={server.name}
            onClose={onClose}
            onEscape={() => (confirmingDelete ? setConfirmingDelete(false) : onClose())}
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
            {confirmingDelete && (
                <div className="confirm-overlay">
                    <div className="confirm-overlay__icon"><IoWarningOutline /></div>
                    <p className="confirm-overlay__heading">Delete MCP Server?</p>
                    <p className="confirm-overlay__body">
                        This will permanently remove{' '}
                        <span className="confirm-overlay__name">{server.name}</span>.
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

            <McpServerFormFields form={form} />

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
                <span className="mcp-test-hint">Connects and lists the tools this server exposes.</span>
            </div>

            {testResult && (
                testResult.ok ? (
                    <div className="mcp-test-result mcp-test-result--ok">
                        <div className="mcp-test-result__head">
                            <IoCheckmarkCircle />
                            Connected · {testResult.tool_count} tool{testResult.tool_count === 1 ? '' : 's'}
                        </div>
                        {testResult.tools.length > 0 && (
                            <div className="mcp-tool-list">
                                {testResult.tools.map((t) => (
                                    <span key={t.name} className="mcp-tool-pill" title={t.description ?? undefined}>
                                        {t.name}
                                    </span>
                                ))}
                            </div>
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
                    <span className="danger-zone__title">Delete Server</span>
                    <span className="danger-zone__desc">Permanently removes this MCP server.</span>
                </div>
                <button className="btn--danger" onClick={() => setConfirmingDelete(true)} type="button">
                    <IoTrashOutline size={13} /> Delete
                </button>
            </div>
        </Modal>
    )
}

export default EditMcpServerModal
