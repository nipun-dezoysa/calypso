import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type KeyboardEvent,
    type RefObject,
} from 'react'
import {
    PROVIDER_SUGGESTIONS,
    findProviderSuggestion,
    type ProviderSuggestion,
} from '../../data/aiProviderSuggestions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderFormOptions {
    initialProviderName?: string
    initialModelTags?: string[]
    initialUrl?: string
    initialSecretKey?: string
}

export interface ProviderFormValues {
    provider_name: string
    model_names: string[]
    url: string | null
    secret_key: string | null
}

export interface ProviderFormHandle {
    // raw state
    providerInput: string
    setProviderInput: (v: string) => void
    providerOpen: boolean
    setProviderOpen: (v: boolean) => void
    selectedProvider: ProviderSuggestion | null
    modelTags: string[]
    modelInput: string
    setModelInput: (v: string) => void
    modelOpen: boolean
    setModelOpen: (v: boolean) => void
    urlValue: string
    setUrlValue: (v: string) => void
    keyValue: string
    setKeyValue: (v: string) => void
    keyVisible: boolean
    setKeyVisible: (fn: (prev: boolean) => boolean) => void
    errors: Record<string, string>
    setErrors: (fn: (prev: Record<string, string>) => Record<string, string>) => void
    // refs
    providerRef: RefObject<HTMLDivElement | null>
    tagInputRef: RefObject<HTMLInputElement | null>
    // derived
    filteredProviders: ProviderSuggestion[]
    availableModels: string[]
    filteredModelSuggestions: string[]
    // actions
    applyProviderSuggestion: (s: ProviderSuggestion) => void
    addModelTag: (value: string) => void
    removeModelTag: (tag: string) => void
    toggleModelPill: (model: string) => void
    handleModelKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
    // validation + collected values
    validate: () => boolean
    formValues: ProviderFormValues
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProviderForm(options?: ProviderFormOptions): ProviderFormHandle {
    const [providerInput, setProviderInput] = useState(options?.initialProviderName ?? '')
    const [providerOpen, setProviderOpen] = useState(false)
    const [selectedProvider, setSelectedProvider] = useState<ProviderSuggestion | null>(
        () => (options?.initialProviderName ? findProviderSuggestion(options.initialProviderName) ?? null : null),
    )
    const providerRef = useRef<HTMLDivElement>(null)

    const [modelTags, setModelTags] = useState<string[]>(options?.initialModelTags ?? [])
    const [modelInput, setModelInput] = useState('')
    const [modelOpen, setModelOpen] = useState(false)
    const tagInputRef = useRef<HTMLInputElement>(null)

    const [urlValue, setUrlValue] = useState(options?.initialUrl ?? '')
    const [keyValue, setKeyValue] = useState(options?.initialSecretKey ?? '')
    const [keyVisible, setKeyVisible] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Click-outside → close provider dropdown
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
                setProviderOpen(false)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [])

    const applyProviderSuggestion = useCallback((s: ProviderSuggestion) => {
        setSelectedProvider(s)
        setProviderInput(s.name)
        setProviderOpen(false)
        setUrlValue((prev) => (s.defaultUrl && !prev ? s.defaultUrl : prev))
        setErrors((prev) => ({ ...prev, provider_name: '' }))
    }, [])

    const addModelTag = useCallback((value: string) => {
        const trimmed = value.trim()
        if (!trimmed) return
        setModelTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
        setModelInput('')
        setErrors((prev) => ({ ...prev, model_names: '' }))
    }, [])

    const removeModelTag = useCallback((tag: string) => {
        setModelTags((prev) => prev.filter((t) => t !== tag))
    }, [])

    const toggleModelPill = useCallback((model: string) => {
        setModelTags((prev) =>
            prev.includes(model) ? prev.filter((t) => t !== model) : [...prev, model],
        )
        setErrors((prev) => ({ ...prev, model_names: '' }))
    }, [])

    const handleModelKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addModelTag(modelInput)
        } else if (e.key === 'Backspace' && !modelInput) {
            setModelTags((prev) => prev.slice(0, -1))
        }
    }, [addModelTag, modelInput])

    const filteredProviders = PROVIDER_SUGGESTIONS.filter((p) =>
        p.name.toLowerCase().includes(providerInput.toLowerCase()),
    )
    const availableModels = selectedProvider?.models ?? []
    const filteredModelSuggestions = availableModels.filter(
        (m) => m.toLowerCase().includes(modelInput.toLowerCase()) && !modelTags.includes(m),
    )

    function validate(): boolean {
        const errs: Record<string, string> = {}
        if (!providerInput.trim()) errs.provider_name = 'Provider name is required.'
        if (modelTags.length === 0) errs.model_names = 'Add at least one model.'
        if (urlValue.trim() && !urlValue.trim().startsWith('http'))
            errs.url = 'URL must start with http:// or https://'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const formValues: ProviderFormValues = {
        provider_name: providerInput.trim(),
        model_names: modelTags,
        url: urlValue.trim() || null,
        secret_key: keyValue.trim() || null,
    }

    return {
        providerInput, setProviderInput,
        providerOpen, setProviderOpen,
        selectedProvider,
        modelTags, modelInput, setModelInput,
        modelOpen, setModelOpen,
        urlValue, setUrlValue,
        keyValue, setKeyValue,
        keyVisible, setKeyVisible,
        errors, setErrors,
        providerRef, tagInputRef,
        filteredProviders, availableModels, filteredModelSuggestions,
        applyProviderSuggestion, addModelTag, removeModelTag,
        toggleModelPill, handleModelKeyDown,
        validate, formValues,
    }
}
