import { useState, useEffect } from 'react'
import { IoSaveOutline, IoInformationCircle, IoPulseOutline } from 'react-icons/io5'
import Modal from './Modal'
import PasswordField from '../auth/PasswordField'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Slider } from '../ui/slider'
import {
    getLangfuseSettings,
    updateLangfuseSettings,
    testLangfuseConnection,
    type LangfuseSettings,
    type LangfuseSettingsUpdate,
    type LangfuseTestResult,
} from '../../api/langfuseApi'
import './ui.css'
// `.mcp-toggle` lives here; the checkbox row reuses it, as AgentFormFields does.
import './mcp.css'

interface LangfuseSettingsModalProps {
    onClose: () => void
}

const DEFAULT_HOST = 'https://cloud.langfuse.com'

function LangfuseSettingsModal({ onClose }: LangfuseSettingsModalProps) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [test, setTest] = useState<LangfuseTestResult | null>(null)

    const [enabled, setEnabled] = useState(false)
    const [host, setHost] = useState('')
    const [publicKey, setPublicKey] = useState('')
    const [secretKey, setSecretKey] = useState('')
    const [secretKeySet, setSecretKeySet] = useState(false)
    const [environment, setEnvironment] = useState('')
    const [samplePercent, setSamplePercent] = useState(100)

    useEffect(() => {
        let active = true
        getLangfuseSettings()
            .then((s: LangfuseSettings) => {
                if (!active) return
                setEnabled(s.enabled)
                setHost(s.host)
                setPublicKey(s.public_key ?? '')
                setSecretKeySet(s.secret_key_set)
                setEnvironment(s.environment ?? '')
                setSamplePercent(Math.round(s.sample_rate * 100))
            })
            .catch((err: unknown) => {
                if (active) setError(err instanceof Error ? err.message : 'Failed to load settings')
            })
            .finally(() => active && setLoading(false))
        return () => { active = false }
    }, [])

    const hasKeys = Boolean(publicKey.trim()) && (secretKeySet || Boolean(secretKey.trim()))

    async function handleTest() {
        setTesting(true)
        setTest(null)
        setError(null)
        try {
            // Blank fields fall back to what is saved, so an untouched secret
            // key still gets tested.
            setTest(await testLangfuseConnection({
                host: host.trim() || DEFAULT_HOST,
                public_key: publicKey.trim() || null,
                secret_key: secretKey.trim() || null,
            }))
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Connection test failed')
        } finally {
            setTesting(false)
        }
    }

    async function handleSave() {
        if (enabled && !hasKeys) {
            setError('A public key and a secret key are required to turn tracing on.')
            return
        }
        setSaving(true)
        setError(null)

        const payload: LangfuseSettingsUpdate = {
            enabled,
            host: host.trim() || DEFAULT_HOST,
            public_key: publicKey.trim() || null,
            environment: environment.trim() || null,
            sample_rate: samplePercent / 100,
        }
        // Only overwrite the secret when the user actually typed a new one.
        if (secretKey.trim()) payload.secret_key = secretKey.trim()

        try {
            await updateLangfuseSettings(payload)
            onClose()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Observability"
            subtitle="Trace every agent and workflow run to Langfuse"
            onClose={onClose}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={handleTest}
                        disabled={testing || loading || !hasKeys}
                        type="button"
                        className="mr-auto"
                    >
                        {testing ? (
                            <><span className="ui-spinner" /> Testing…</>
                        ) : (
                            <><IoPulseOutline style={{ fontSize: 15 }} /> Test connection</>
                        )}
                    </Button>
                    <Button variant="secondary" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading} type="button">
                        {saving ? (
                            <><span className="ui-spinner" /> Saving…</>
                        ) : (
                            <><IoSaveOutline style={{ fontSize: 15 }} /> Save</>
                        )}
                    </Button>
                </>
            }
        >
            {loading ? (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="ui-spinner" /> Loading settings…
                </div>
            ) : (
                <>
                    {error && <div className="form-error form-error--banner">{error}</div>}

                    {test && (
                        <div
                            className={
                                test.ok
                                    ? 'form-info-note'
                                    : 'form-error form-error--banner'
                            }
                        >
                            {test.ok && <IoInformationCircle className="form-info-note-icon" />}
                            <span>{test.detail}</span>
                        </div>
                    )}

                    <div className="form-field">
                        <Label className="mcp-toggle">
                            <Checkbox
                                checked={enabled}
                                onCheckedChange={(checked) => setEnabled(checked === true)}
                            />
                            <span>Send traces to Langfuse</span>
                        </Label>
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="lf-host">
                            Host
                            <span className="form-label-optional">defaults to Langfuse Cloud</span>
                        </label>
                        <Input
                            id="lf-host"
                            placeholder={DEFAULT_HOST}
                            value={host}
                            onChange={(e) => { setHost(e.target.value); setTest(null) }}
                            spellCheck={false}
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="lf-pk">
                            Public Key
                            <span className="form-label-required">* required</span>
                        </label>
                        <Input
                            id="lf-pk"
                            placeholder="pk-lf-…"
                            value={publicKey}
                            onChange={(e) => { setPublicKey(e.target.value); setTest(null) }}
                            spellCheck={false}
                            autoComplete="off"
                            className="font-mono tracking-wide"
                        />
                    </div>

                    <PasswordField
                        id="lf-sk"
                        label="Secret Key"
                        hint={secretKeySet ? 'configured' : '* required'}
                        value={secretKey}
                        onChange={(v) => { setSecretKey(v); setTest(null) }}
                        placeholder={secretKeySet ? '•••••••• (leave blank to keep)' : 'sk-lf-…'}
                        autoComplete="new-password"
                    />

                    <hr className="ui-divider" />

                    <div className="form-field">
                        <label className="form-label" htmlFor="lf-env">
                            Environment
                            <span className="form-label-optional">optional</span>
                        </label>
                        <Input
                            id="lf-env"
                            placeholder="e.g. production"
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
                            spellCheck={false}
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label">
                            Sampling
                            <span className="form-label-optional">{samplePercent}% of runs</span>
                        </label>
                        <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[samplePercent]}
                            onValueChange={([v]) => setSamplePercent(v)}
                        />
                    </div>

                    <div className="form-info-note">
                        <IoInformationCircle className="form-info-note-icon" />
                        <span>
                            Each chat turn becomes one trace, with a span per workflow node and
                            per tool call. Threads are grouped as Langfuse sessions.
                        </span>
                    </div>
                </>
            )}
        </Modal>
    )
}

export default LangfuseSettingsModal
