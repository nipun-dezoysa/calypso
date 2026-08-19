import { useState } from 'react'
import { IoSaveOutline } from 'react-icons/io5'
import Modal from './Modal'
import PasswordField from '../auth/PasswordField'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useAuthStore } from '../../stores/AuthStore'
import './ui.css'

const MIN_PASSWORD_LENGTH = 8

interface AccountSettingsModalProps {
    onClose: () => void
}

function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
    const user = useAuthStore((s) => s.user)
    const updateCredentials = useAuthStore((s) => s.updateCredentials)

    const [username, setUsername] = useState(user?.username ?? '')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        const nextUsername = username.trim()
        const wantsUsernameChange = nextUsername !== '' && nextUsername !== user?.username
        const wantsPasswordChange = newPassword.length > 0

        if (!nextUsername) {
            setError('Username must not be empty.')
            return
        }
        if (!wantsUsernameChange && !wantsPasswordChange) {
            setError('Change your username, your password, or both.')
            return
        }
        if (!currentPassword) {
            setError('Enter your current password to confirm the change.')
            return
        }
        if (wantsPasswordChange) {
            if (newPassword.length < MIN_PASSWORD_LENGTH) {
                setError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
                return
            }
            if (newPassword !== confirmPassword) {
                setError('The two new passwords do not match.')
                return
            }
        }

        setSaving(true)
        setError('')
        try {
            await updateCredentials({
                current_password: currentPassword,
                username: wantsUsernameChange ? nextUsername : undefined,
                new_password: wantsPasswordChange ? newPassword : undefined,
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update your account.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Account"
            subtitle="Username & password"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        type="button"
                    >
                        {saving ? (
                            <><span className="ui-spinner" /> Saving…</>
                        ) : (
                            <><IoSaveOutline style={{ fontSize: 15 }} /> Save</>
                        )}
                    </Button>
                </>
            }
        >
            {error && <div className="form-error form-error--banner">{error}</div>}

            <div className="form-field">
                <label className="form-label" htmlFor="acct-username">
                    Username
                </label>
                <Input
                    id="acct-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={saving}
                    spellCheck={false}
                />
            </div>

            <PasswordField
                id="acct-current"
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="••••••••"
                disabled={saving}
                hint="required to confirm any change"
            />

            <hr className="ui-divider" />

            <PasswordField
                id="acct-new"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={saving}
                hint={`optional · at least ${MIN_PASSWORD_LENGTH} characters`}
            />

            {newPassword.length > 0 && (
                <PasswordField
                    id="acct-confirm"
                    label="Confirm new password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={saving}
                />
            )}
        </Modal>
    )
}

export default AccountSettingsModal
