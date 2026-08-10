import { type ReactElement } from 'react'
import { IoClose, IoCheckmark, IoEye, IoEyeOff, IoInformationCircle } from 'react-icons/io5'
import { formatTokens, suggestContextTokens } from '../../data/aiProviderSuggestions'
import type { ProviderFormHandle } from './useProviderForm'

// ---------------------------------------------------------------------------
// Highlight helper
// ---------------------------------------------------------------------------

function highlightMatch(text: string, query: string): ReactElement {
    if (!query) return <>{text}</>
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
        <>
            {text.slice(0, idx)}
            <strong style={{ color: '#fbbf24' }}>{text.slice(idx, idx + query.length)}</strong>
            {text.slice(idx + query.length)}
        </>
    )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProviderFormFieldsProps {
    form: ProviderFormHandle
    /** Show the info note about key storage. Default true */
    showInfoNote?: boolean
}

// ---------------------------------------------------------------------------
// Component — renders all 4 provider fields using shared CSS classes
// ---------------------------------------------------------------------------

function ProviderFormFields({ form, showInfoNote = true }: ProviderFormFieldsProps) {
    const {
        providerInput, setProviderInput,
        providerOpen, setProviderOpen,
        selectedProvider,
        providerRef,
        modelTags, modelContexts, setModelContext,
        modelInput, setModelInput,
        modelOpen, setModelOpen,
        tagInputRef,
        urlValue, setUrlValue,
        keyValue, setKeyValue,
        keyVisible, setKeyVisible,
        errors, setErrors,
        filteredProviders, availableModels, filteredModelSuggestions,
        applyProviderSuggestion, removeModelTag, toggleModelPill, handleModelKeyDown,
    } = form

    return (
        <>
            {/* ── Provider name combobox ── */}
            <div className="form-field">
                <label className="form-label">
                    Provider Name
                    <span className="form-label-required">* required</span>
                </label>

                <div className="form-combobox" ref={providerRef}>
                    <input
                        id="pf-provider-name"
                        className="form-input"
                        placeholder="e.g. OpenAI, Ollama, or a custom name…"
                        value={providerInput}
                        onChange={(e) => {
                            setProviderInput(e.target.value)
                            setProviderOpen(true)
                            setErrors((prev) => ({ ...prev, provider_name: '' }))
                        }}
                        onFocus={() => setProviderOpen(true)}
                        autoComplete="off"
                        spellCheck={false}
                    />

                    {providerOpen && filteredProviders.length > 0 && (
                        <div className="form-suggestions">
                            {filteredProviders.map((p) => (
                                <div
                                    key={p.name}
                                    className={`form-suggestion-item ${selectedProvider?.name === p.name ? 'form-suggestion-item--active' : ''}`}
                                    onMouseDown={(e) => { e.preventDefault(); applyProviderSuggestion(p) }}
                                >
                                    <div className="form-suggestion-dot" style={{ background: p.accentColor }} />
                                    <div className="form-suggestion-info">
                                        <div className="form-suggestion-name">
                                            {highlightMatch(p.name, providerInput)}
                                        </div>
                                        <div className="form-suggestion-desc">{p.description}</div>
                                    </div>
                                    {selectedProvider?.name === p.name && (
                                        <IoCheckmark style={{ color: '#d97706', flexShrink: 0 }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedProvider && (
                    <span
                        className="form-badge"
                        style={{
                            background: `${selectedProvider.accentColor}18`,
                            borderColor: `${selectedProvider.accentColor}40`,
                            color: selectedProvider.accentColor,
                        }}
                    >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedProvider.accentColor, display: 'inline-block' }} />
                        {selectedProvider.name}
                    </span>
                )}
                {errors.provider_name && <div className="form-error">{errors.provider_name}</div>}
            </div>

            {/* ── Models tag input ── */}
            <div className="form-field">
                <label className="form-label">
                    Models
                    <span className="form-label-required">* required</span>
                </label>

                <div className="form-tags-container" onClick={() => tagInputRef.current?.focus()}>
                    {modelTags.map((tag) => (
                        <span key={tag} className="form-tag">
                            <span className="form-tag-text">{tag}</span>
                            <button
                                className="form-tag-remove"
                                onClick={(e) => { e.stopPropagation(); removeModelTag(tag) }}
                                aria-label={`Remove ${tag}`}
                            >
                                <IoClose />
                            </button>
                        </span>
                    ))}
                    <input
                        ref={tagInputRef}
                        className="form-tag-input"
                        placeholder={modelTags.length === 0 ? 'Type a model name and press Enter…' : ''}
                        value={modelInput}
                        onChange={(e) => { setModelInput(e.target.value); setModelOpen(e.target.value.length > 0) }}
                        onKeyDown={handleModelKeyDown}
                        onFocus={() => setModelOpen(true)}
                        onBlur={() => { setTimeout(() => setModelOpen(false), 150) }}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                {availableModels.length > 0 && (
                    <div>
                        <p style={{ fontSize: 11, color: '#52525b', marginBottom: 5 }}>
                            Suggested for <strong style={{ color: '#a1a1aa' }}>{selectedProvider?.name}</strong> — click to toggle:
                        </p>
                        <div className="form-model-pills">
                            {(modelOpen ? filteredModelSuggestions : availableModels.filter((m) => !modelTags.includes(m))).map((m) => (
                                <button
                                    key={m}
                                    className={`form-model-pill ${modelTags.includes(m) ? 'form-model-pill--on' : ''}`}
                                    onClick={() => toggleModelPill(m)}
                                    type="button"
                                >
                                    {modelTags.includes(m) && <IoCheckmark style={{ marginRight: 3, fontSize: 10 }} />}
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {errors.model_names && <div className="form-error">{errors.model_names}</div>}
            </div>

            {/* ── Context window per model ── */}
            {modelTags.length > 0 && (
                <div className="form-field">
                    <label className="form-label">
                        Context Window
                        <span className="form-label-optional">optional</span>
                    </label>
                    <p style={{ fontSize: 11, color: '#52525b', marginBottom: 8 }}>
                        How many tokens each model can hold at once. Calypso replays up to
                        half of it as conversation history — a bigger model remembers more.
                        Leave blank to use the server default.
                    </p>

                    <div className="form-context-rows">
                        {modelTags.map((model) => {
                            const suggested = suggestContextTokens(model)
                            const value = modelContexts[model]
                            return (
                                <div key={model} className="form-context-row">
                                    <span className="form-context-name" title={model}>{model}</span>
                                    <input
                                        className="form-input form-context-input"
                                        type="number"
                                        min={1}
                                        step={1024}
                                        placeholder="server default"
                                        value={value === undefined ? '' : value}
                                        onChange={(e) => {
                                            const raw = e.target.value
                                            setModelContext(model, raw === '' ? '' : Number(raw))
                                        }}
                                    />
                                    <span className="form-context-hint">
                                        {typeof value === 'number' && value > 0
                                            ? `${formatTokens(value)} tokens`
                                            : suggested
                                              ? `suggested ${formatTokens(suggested)}`
                                              : 'unknown'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    {errors.model_contexts && (
                        <div className="form-error">{errors.model_contexts}</div>
                    )}
                </div>
            )}

            {/* ── Base URL ── */}
            <div className="form-field">
                <label className="form-label" htmlFor="pf-url">
                    Base URL
                    <span className="form-label-optional">optional</span>
                </label>
                <input
                    id="pf-url"
                    className="form-input"
                    placeholder={selectedProvider?.defaultUrl ?? 'https://api.example.com/v1'}
                    value={urlValue}
                    onChange={(e) => { setUrlValue(e.target.value); setErrors((p) => ({ ...p, url: '' })) }}
                    spellCheck={false}
                />
                {errors.url && <div className="form-error">{errors.url}</div>}
            </div>

            {/* ── Secret key ── */}
            <div className="form-field">
                <label className="form-label" htmlFor="pf-key">
                    Secret Key / API Key
                    {selectedProvider
                        ? selectedProvider.requiresKey
                            ? <span className="form-label-required">* required for {selectedProvider.name}</span>
                            : <span className="form-label-optional">not needed for {selectedProvider.name}</span>
                        : <span className="form-label-optional">optional</span>}
                </label>
                <div className="form-pw-wrapper">
                    <input
                        id="pf-key"
                        className="form-input"
                        type={keyVisible ? 'text' : 'password'}
                        placeholder={selectedProvider?.keyHint ?? 'Paste your API key here…'}
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        disabled={selectedProvider?.requiresKey === false && !keyValue}
                        autoComplete="new-password"
                        spellCheck={false}
                    />
                    <button
                        className="form-pw-toggle"
                        onClick={() => setKeyVisible((v) => !v)}
                        type="button"
                        aria-label={keyVisible ? 'Hide key' : 'Show key'}
                    >
                        {keyVisible ? <IoEyeOff /> : <IoEye />}
                    </button>
                </div>
            </div>

            {/* ── Info note ── */}
            {showInfoNote && (
                <div className="form-info-note">
                    <IoInformationCircle className="form-info-note-icon" />
                    <span>
                        Secret keys are stored in your local database. For local providers like Ollama or LM Studio, no key is needed — just set the Base URL.
                    </span>
                </div>
            )}
        </>
    )
}

export default ProviderFormFields
