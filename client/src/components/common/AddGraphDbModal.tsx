import { useState } from 'react'
import { IoAdd } from 'react-icons/io5'
import Modal from './Modal'
import GraphDbFormFields from './GraphDbFormFields'
import { useGraphDbForm } from './useGraphDbForm'
import { createGraphDb, type GraphDb } from '../../api/graphDbApi'
import './ui.css'
import './mcp.css'
import './graph.css'

interface AddGraphDbModalProps {
    onClose: () => void
    onCreated: (graphDb: GraphDb) => void
}

function AddGraphDbModal({ onClose, onCreated }: AddGraphDbModalProps) {
    const form = useGraphDbForm()
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            const created = await createGraphDb(form.formValues)
            onCreated(created)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to add graph database'
            form.setErrors((prev) => ({ ...prev, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            title="Add Graph Database"
            subtitle="Connect a Neo4j database agents can query"
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
                            <><IoAdd style={{ fontSize: 16 }} /> Add Database</>
                        )}
                    </button>
                </>
            }
        >
            {form.errors._global && (
                <div className="form-error form-error--banner">{form.errors._global}</div>
            )}
            <GraphDbFormFields form={form} />
            <p className="form-hint">
                You can test the connection once it's saved.
            </p>
        </Modal>
    )
}

export default AddGraphDbModal
