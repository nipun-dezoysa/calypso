import { useState } from 'react'
import { IoAdd, IoPencilOutline, IoTrashOutline, IoWarningOutline } from 'react-icons/io5'
import Modal from './Modal'
import ProviderFormFields from './ProviderFormFields'
import { useProviderForm } from './useProviderForm'
import { updateAIProvider, deleteAIProvider, type AIProvider } from '../../api/aiProviderApi'
import './ui.css'


interface EditProviderModalProps {
    provider: AIProvider
    onClose: () => void
    onUpdated: (updated: AIProvider) => void
    onDeleted: (id: string) => void
}


function EditProviderModal({ provider, onClose, onUpdated, onDeleted }: EditProviderModalProps) {
    const form = useProviderForm({
        initialProviderName: provider.provider_name,
        initialModelTags:    provider.model_names,
        initialUrl:          provider.url ?? '',
        initialSecretKey:    provider.secret_key ?? '',
    })

    const [submitting, setSubmitting]           = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting]               = useState(false)

    async function handleSave() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            const updated = await updateAIProvider(provider.id, form.formValues)
            onUpdated(updated)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update provider'
            form.setErrors((p) => ({ ...p, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    async function handleConfirmDelete() {
        setDeleting(true)
        try {
            await deleteAIProvider(provider.id)
            onDeleted(provider.id)
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete provider'
            form.setErrors((p) => ({ ...p, _global: msg }))
            setConfirmingDelete(false)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Modal
            title={<> Edit Provider</>}
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
                    <p className="confirm-overlay__heading">Delete Provider?</p>
                    <p className="confirm-overlay__body">
                        This will permanently remove{' '}
                        <span className="confirm-overlay__name">{provider.provider_name}</span>{' '}
                        and all its models. This cannot be undone.
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

            <ProviderFormFields form={form} showInfoNote={false} />

            <hr className="ui-divider" />
            <div className="danger-zone">
                <div className="danger-zone__label">
                    <span className="danger-zone__title">Delete Provider</span>
                    <span className="danger-zone__desc">Permanently removes this provider and all its models.</span>
                </div>
                <button className="btn--danger" onClick={() => setConfirmingDelete(true)} type="button">
                    <IoTrashOutline size={13} /> Delete
                </button>
            </div>
        </Modal>
    )
}

export default EditProviderModal
