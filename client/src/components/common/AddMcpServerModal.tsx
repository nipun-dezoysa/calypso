import { useState } from 'react'
import { IoAdd } from 'react-icons/io5'
import Modal from './Modal'
import McpServerFormFields from './McpServerFormFields'
import { useMcpServerForm } from './useMcpServerForm'
import { createMcpServer, type McpServer } from '../../api/mcpApi'
import './ui.css'
import './mcp.css'

interface AddMcpServerModalProps {
    onClose: () => void
    onCreated: (server: McpServer) => void
}

function AddMcpServerModal({ onClose, onCreated }: AddMcpServerModalProps) {
    const form = useMcpServerForm()
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            const created = await createMcpServer(form.formValues)
            onCreated(created)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to add MCP server'
            form.setErrors((prev) => ({ ...prev, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            title="Add MCP Server"
            subtitle="Connect a Model Context Protocol server"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn--cancel" onClick={onClose} type="button">
                        Cancel
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSubmit}
                        disabled={submitting}
                        type="button"
                    >
                        {submitting ? (
                            <><span className="ui-spinner" /> Adding…</>
                        ) : (
                            <><IoAdd style={{ fontSize: 16 }} /> Add Server</>
                        )}
                    </button>
                </>
            }
        >
            {form.errors._global && (
                <div className="form-error form-error--banner">{form.errors._global}</div>
            )}
            <McpServerFormFields form={form} />
        </Modal>
    )
}

export default AddMcpServerModal
