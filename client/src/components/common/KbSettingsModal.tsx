import { useState, useEffect } from 'react'
import { IoSaveOutline, IoInformationCircle } from 'react-icons/io5'
import Modal from './Modal'
import PasswordField from '../auth/PasswordField'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import {
    getKbSettings,
    updateKbSettings,
    type KbSettings,
    type KbSettingsUpdate,
    type VectorDbProvider,
    type EmbeddingProvider,
} from '../../api/kbApi'
import './ui.css'
import './kb.css'

interface KbSettingsModalProps {
    onClose: () => void
}

const VECTOR_OPTIONS: { id: VectorDbProvider; label: string; hint: string }[] = [
    { id: 'chroma', label: 'Chroma', hint: 'Local · default' },
    { id: 'qdrant', label: 'Qdrant', hint: 'Remote · credentials' },
]

const EMBED_OPTIONS: { id: EmbeddingProvider; label: string; hint: string }[] = [
    { id: 'fastembed', label: 'FastEmbed', hint: 'On-device · default' },
    { id: 'nomic', label: 'Nomic', hint: 'API key required' },
]

function Segmented<T extends string>({
    options,
    value,
    onChange,
}: {
    options: { id: T; label: string; hint: string }[]
    value: T
    onChange: (v: T) => void
}) {
    return (
        <ToggleGroup
            type="single"
            variant="outline"
            value={value}
            onValueChange={(v) => { if (v) onChange(v as T) }}
            className="w-full gap-2"
        >
            {options.map((opt) => (
                <ToggleGroupItem
                    key={opt.id}
                    value={opt.id}
                    className="h-auto flex-col items-start gap-0.5 whitespace-normal rounded-(--radius)! px-3 py-2 text-left data-[state=on]:border-(--c-accent) data-[state=on]:bg-(--c-accent)/10"
                >
                    <span className="text-[13px] font-medium">{opt.label}</span>
                    <span className="text-[10.5px] text-muted-foreground">{opt.hint}</span>
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    )
}

function KbSettingsModal({ onClose }: KbSettingsModalProps) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [vectorProvider, setVectorProvider] = useState<VectorDbProvider>('chroma')
    const [qdrantUrl, setQdrantUrl] = useState('')
    const [qdrantKey, setQdrantKey] = useState('')
    const [qdrantKeySet, setQdrantKeySet] = useState(false)

    const [embedProvider, setEmbedProvider] = useState<EmbeddingProvider>('fastembed')
    const [embedModel, setEmbedModel] = useState('')
    const [nomicKey, setNomicKey] = useState('')
    const [nomicKeySet, setNomicKeySet] = useState(false)

    useEffect(() => {
        let active = true
        getKbSettings()
            .then((s: KbSettings) => {
                if (!active) return
                setVectorProvider(s.vector_db_provider)
                setQdrantUrl(s.qdrant_url ?? '')
                setQdrantKeySet(s.qdrant_api_key_set)
                setEmbedProvider(s.embedding_provider)
                setEmbedModel(s.embedding_model ?? '')
                setNomicKeySet(s.nomic_api_key_set)
            })
            .catch((err: unknown) => {
                if (active) setError(err instanceof Error ? err.message : 'Failed to load settings')
            })
            .finally(() => active && setLoading(false))
        return () => { active = false }
    }, [])

    async function handleSave() {
        if (vectorProvider === 'qdrant' && !qdrantUrl.trim()) {
            setError('Qdrant URL is required when using Qdrant.')
            return
        }
        setSaving(true)
        setError(null)

        const payload: KbSettingsUpdate = {
            vector_db_provider: vectorProvider,
            embedding_provider: embedProvider,
            embedding_model: embedModel.trim() || null,
            qdrant_url: qdrantUrl.trim() || null,
        }
        // Only overwrite secrets when the user actually typed a new value.
        if (qdrantKey.trim()) payload.qdrant_api_key = qdrantKey.trim()
        if (nomicKey.trim()) payload.nomic_api_key = nomicKey.trim()

        try {
            await updateKbSettings(payload)
            onClose()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Knowledgebase Settings"
            subtitle="Vector store & embedding model"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || loading}
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
            {loading ? (
                <div className="py-4 flex items-center justify-center gap-2 text-(--c-text-muted) text-xs">
                    <span className="ui-spinner" /> Loading settings…
                </div>
            ) : (
                <>
                    {error && <div className="form-error form-error--banner">{error}</div>}

                    {/* ── Vector store ── */}
                    <div className="form-field">
                        <label className="form-label">Vector Store</label>
                        <Segmented
                            options={VECTOR_OPTIONS}
                            value={vectorProvider}
                            onChange={setVectorProvider}
                        />
                    </div>

                    {vectorProvider === 'qdrant' && (
                        <>
                            <div className="form-field">
                                <label className="form-label" htmlFor="ks-qurl">
                                    Qdrant URL
                                    <span className="form-label-required">* required</span>
                                </label>
                                <Input
                                    id="ks-qurl"
                                    placeholder="https://your-cluster.qdrant.io:6333"
                                    value={qdrantUrl}
                                    onChange={(e) => setQdrantUrl(e.target.value)}
                                    spellCheck={false}
                                />
                            </div>
                            <PasswordField
                                id="ks-qkey"
                                label="Qdrant API Key"
                                hint={qdrantKeySet ? 'configured' : 'optional'}
                                value={qdrantKey}
                                onChange={setQdrantKey}
                                placeholder={qdrantKeySet ? '•••••••• (leave blank to keep)' : 'Paste API key…'}
                                autoComplete="new-password"
                            />
                        </>
                    )}

                    <hr className="ui-divider" />

                    {/* ── Embedder ── */}
                    <div className="form-field">
                        <label className="form-label">Embedding Model</label>
                        <Segmented
                            options={EMBED_OPTIONS}
                            value={embedProvider}
                            onChange={setEmbedProvider}
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="ks-model">
                            Model Name
                            <span className="form-label-optional">optional</span>
                        </label>
                        <Input
                            id="ks-model"
                            placeholder={
                                embedProvider === 'nomic'
                                    ? 'nomic-embed-text-v1.5'
                                    : 'BAAI/bge-small-en-v1.5'
                            }
                            value={embedModel}
                            onChange={(e) => setEmbedModel(e.target.value)}
                            spellCheck={false}
                        />
                    </div>

                    {embedProvider === 'nomic' && (
                        <PasswordField
                            id="ks-nkey"
                            label="Nomic API Key"
                            hint={nomicKeySet ? 'configured' : '* required'}
                            value={nomicKey}
                            onChange={setNomicKey}
                            placeholder={nomicKeySet ? '•••••••• (leave blank to keep)' : 'Paste API key…'}
                            autoComplete="new-password"
                        />
                    )}

                    <div className="form-info-note">
                        <IoInformationCircle className="form-info-note-icon" />
                        <span>
                            Changing the embedding model only affects documents indexed afterwards.
                            Re-upload existing files to re-embed them.
                        </span>
                    </div>
                </>
            )}
        </Modal>
    )
}

export default KbSettingsModal
