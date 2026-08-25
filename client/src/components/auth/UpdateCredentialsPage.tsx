import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../stores/AuthStore'
import PasswordField from './PasswordField'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import './auth.css'

const MIN_PASSWORD_LENGTH = 8

function UpdateCredentialsPage() {
    const user = useAuthStore((s) => s.user)
    const updateCredentials = useAuthStore((s) => s.updateCredentials)
    const logout = useAuthStore((s) => s.logout)

    const [username, setUsername] = useState(user?.username ?? '')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        const nextUsername = username.trim()
        if (!nextUsername) {
            setError('Username must not be empty.')
            return
        }
        if (!currentPassword) {
            setError('Enter your current password to confirm the change.')
            return
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
            return
        }
        if (newPassword !== confirmPassword) {
            setError('The two new passwords do not match.')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            await updateCredentials({
                current_password: currentPassword,
                username: nextUsername,
                new_password: newPassword,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update credentials.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="auth-brand">
                    Choose your credentials<span>.</span>
                </h1>
                <p className="auth-subtitle">
                    This instance still uses the default sign-in details. Pick a username and
                    password of your own before you continue.
                </p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="form-error form-error--banner">{error}</div>}

                    <div className="form-field">
                        <label className="form-label" htmlFor="creds-username">
                            Username
                            <span className="form-label-required">* required</span>
                        </label>
                        <Input
                            id="creds-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            autoFocus
                            disabled={submitting}
                            spellCheck={false}
                        />
                    </div>

                    <PasswordField
                        id="creds-current"
                        label="Current password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        placeholder="••••••••"
                        disabled={submitting}
                    />

                    <PasswordField
                        id="creds-new"
                        label="New password"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={submitting}
                        hint={`at least ${MIN_PASSWORD_LENGTH} characters`}
                    />

                    <PasswordField
                        id="creds-confirm"
                        label="Confirm new password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={submitting}
                    />

                    <Button
                        type="submit"
                        className="auth-submit"
                        disabled={submitting}
                    >
                        {submitting && <span className="ui-spinner" />}
                        {submitting ? 'Saving…' : 'Save and continue'}
                    </Button>
                </form>

                <p className="auth-note">
                    Signed in as <code>{user?.username}</code>.{' '}
                    <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-(--c-accent)"
                        onClick={logout}
                    >
                        sign out
                    </Button>
                </p>
            </div>
        </div>
    )
}

export default UpdateCredentialsPage
