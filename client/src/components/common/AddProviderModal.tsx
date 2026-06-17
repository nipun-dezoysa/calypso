import { useState } from 'react'
import { IoAdd } from 'react-icons/io5'
import Modal from './Modal'
import ProviderFormFields from './ProviderFormFields'
import { useProviderForm } from './useProviderForm'

export interface NewProviderPayload {
    provider_name: string
    model_names: string[]
    url?: string
    secret_key?: string
}

interface AddProviderModalProps {
    onClose: () => void
    onSubmit: (payload: NewProviderPayload) => Promise<void>
}

function AddProviderModal({ onClose, onSubmit }: AddProviderModalProps) {
    const form = useProviderForm()
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit() {
        if (!form.validate()) return
        setSubmitting(true)
        try {
            await onSubmit({
                provider_name: form.formValues.provider_name,
                model_names: form.formValues.model_names,
                url: form.formValues.url ?? undefined,
                secret_key: form.formValues.secret_key ?? undefined,
            })
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to add provider'
            form.setErrors((prev) => ({ ...prev, _global: msg }))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            title="Add AI Provider"
            subtitle="Connect a new LLM provider to Calypso"
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
                            <><IoAdd style={{ fontSize: 16 }} /> Add Provider</>
                        )}
                    </button>
                </>
            }
        >
            {form.errors._global && (
                <div className="form-error form-error--banner">{form.errors._global}</div>
            )}
            <ProviderFormFields form={form} />
        </Modal>
    )
}

export default AddProviderModal
