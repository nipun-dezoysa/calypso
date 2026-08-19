import { useState } from 'react'
import { IoAdd } from 'react-icons/io5'
import Modal from './Modal'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { createCollection, type Collection } from '../../api/kbApi'
import './ui.css'

interface CreateCollectionModalProps {
    onClose: () => void
    onCreated: (collection: Collection) => void
}

function CreateCollectionModal({ onClose, onCreated }: CreateCollectionModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    async function handleSubmit() {
        if (!name.trim()) {
            setErrors({ name: 'Name is required.' })
            return
        }
        setSubmitting(true)
        try {
            const created = await createCollection({
                name: name.trim(),
                description: description.trim() || null,
            })
            onCreated(created)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to create collection'
            setErrors({ _global: msg })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            title="New Knowledgebase"
            subtitle="Create a collection to store and search documents"
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
                            <><span className="ui-spinner" /> Creating…</>
                        ) : (
                            <><IoAdd style={{ fontSize: 16 }} /> Create</>
                        )}
                    </button>
                </>
            }
        >
            {errors._global && (
                <div className="form-error form-error--banner">{errors._global}</div>
            )}

            <div className="form-field">
                <label className="form-label" htmlFor="cc-name">
                    Name
                    <span className="form-label-required">* required</span>
                </label>
                <Input
                    id="cc-name"
                    placeholder="e.g. Product Docs"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors({}) }}
                    autoFocus
                    spellCheck={false}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-field">
                <label className="form-label" htmlFor="cc-desc">
                    Description
                    <span className="form-label-optional">optional</span>
                </label>
                <Textarea
                    id="cc-desc"
                    placeholder="What lives in this knowledgebase?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 64 }}
                />
            </div>
        </Modal>
    )
}

export default CreateCollectionModal
