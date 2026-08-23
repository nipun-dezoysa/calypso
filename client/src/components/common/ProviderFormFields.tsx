import { type ReactElement } from 'react'
import { IoClose, IoCheckmark, IoEye, IoEyeOff, IoInformationCircle } from 'react-icons/io5'
import { formatTokens, suggestContextTokens } from '../../data/aiProviderSuggestions'
import type { ProviderFormHandle } from './useProviderForm'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover'
import { Command, CommandList, CommandGroup, CommandItem } from '../ui/command'

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

                <Popover open={providerOpen && filteredProviders.length > 0} onOpenChange={setProviderOpen}>
                    <PopoverAnchor asChild>
                        <Input
                            id="pf-provider-name"
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
                    </PopoverAnchor>
                    <PopoverContent
                        className="w-(--radix-popover-trigger-width) p-0"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        <Command shouldFilter={false}>
                            <CommandList>
                                <CommandGroup>
                                    {filteredProviders.map((p) => (
                                        <CommandItem
                                            key={p.name}
                                            value={p.name}
                                            onSelect={() => applyProviderSuggestion(p)}
                                            className={selectedProvider?.name === p.name ? 'bg-accent text-accent-foreground' : ''}
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ background: p.accentColor }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium">
                                                    {highlightMatch(p.name, providerInput)}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                                            </div>
                                            {selectedProvider?.name === p.name && (
                                                <IoCheckmark style={{ color: '#d97706', flexShrink: 0 }} />
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

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
                        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                            <span className="overflow-hidden text-ellipsis">{tag}</span>
                            <button
                                type="button"
                                className="flex items-center text-muted-foreground hover:text-destructive transition-colors"
                                onClick={(e) => { e.stopPropagation(); removeModelTag(tag) }}
                                aria-label={`Remove ${tag}`}
                            >
                                <IoClose size={11} />
                            </button>
                        </Badge>
                    ))}
                    <Input
                        ref={tagInputRef}
                        placeholder={modelTags.length === 0 ? 'Type a model name and press Enter…' : ''}
                        value={modelInput}
                        onChange={(e) => { setModelInput(e.target.value); setModelOpen(e.target.value.length > 0) }}
                        onKeyDown={handleModelKeyDown}
                        onFocus={() => setModelOpen(true)}
                        onBlur={() => { setTimeout(() => setModelOpen(false), 150) }}
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 min-w-[100px] h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
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
                                    <Input
                                        type="number"
                                        min={1}
                                        step={1024}
                                        placeholder="server default"
                                        value={value === undefined ? '' : value}
                                        onChange={(e) => {
                                            const raw = e.target.value
                                            setModelContext(model, raw === '' ? '' : Number(raw))
                                        }}
                                        className="w-[130px] shrink-0"
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
                <Input
                    id="pf-url"
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
                <div className="relative">
                    <Input
                        id="pf-key"
                        type={keyVisible ? 'text' : 'password'}
                        placeholder={selectedProvider?.keyHint ?? 'Paste your API key here…'}
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        disabled={selectedProvider?.requiresKey === false && !keyValue}
                        autoComplete="new-password"
                        spellCheck={false}
                        className="pr-10 font-mono tracking-wide"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 size-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                        onClick={() => setKeyVisible((v) => !v)}
                        aria-label={keyVisible ? 'Hide key' : 'Show key'}
                        tabIndex={-1}
                    >
                        {keyVisible ? <IoEyeOff /> : <IoEye />}
                    </Button>
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
