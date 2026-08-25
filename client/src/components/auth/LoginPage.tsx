import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../stores/AuthStore'
import PasswordField from './PasswordField'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import './auth.css'

function LoginPage() {
    const login = useAuthStore((s) => s.login)

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!username.trim() || !password) {
            setError('Enter both a username and a password.')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            await login(username.trim(), password)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed.')
            setPassword('')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="auth-brand">
                    Calypso<span>.</span>
                </h1>
                <p className="auth-subtitle">Sign in to manage your agents and workflows.</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="form-error form-error--banner">{error}</div>}

                    <div className="form-field">
                        <label className="form-label" htmlFor="auth-username">
                            Username
                        </label>
                        <Input
                            id="auth-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            autoComplete="username"
                            autoFocus
                            disabled={submitting}
                            spellCheck={false}
                        />
                    </div>

                    <PasswordField
                        id="auth-password"
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        placeholder="••••••••"
                        disabled={submitting}
                    />

                    <Button
                        type="submit"
                        className="auth-submit"
                        disabled={submitting}
                    >
                        {submitting && <span className="ui-spinner" />}
                        {submitting ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>

                <p className="auth-note">
                    First run? Sign in with the default credentials
                    <br />
                    <code>admin</code> / <code>admin</code>. You will be asked to change them.
                </p>
            </div>
        </div>
    )
}

export default LoginPage
