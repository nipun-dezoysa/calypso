import { useEffect, useMemo, useRef, useState } from 'react'
import {
    IoArrowUp,
    IoCloseOutline,
    IoRefreshOutline,
    IoSparklesOutline,
    IoStopCircleOutline,
    IoWarningOutline,
} from 'react-icons/io5'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AIProvider } from '../../../api/aiProviderApi'
import {
    designWorkflow,
    type DesignerDraft,
    type DesignerMessage,
    type ProposedWorkflow,
} from '../../../api/workflowDesignerApi'

interface DesignerPanelProps {
    providers: AIProvider[]
    getGraph: () => DesignerDraft
    onApply: (workflow: ProposedWorkflow) => void
    onClose: () => void
}

interface Turn {
    id: string
    role: 'user' | 'assistant'
    content: string
    notes: string[]
    applied: boolean
}

const MODEL_STORAGE_KEY = 'calypso_designer_model'

const EXAMPLES = [
    'Build a support workflow that classifies the message, then answers billing questions differently from everything else.',
    'Add a step at the end that rewrites the answer to be shorter and friendlier.',
    'Explain what this workflow does, step by step.',
]

export default function DesignerPanel({
    providers,
    getGraph,
    onApply,
    onClose,
}: DesignerPanelProps) {
    const [turns, setTurns] = useState<Turn[]>([])
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [modelId, setModelId] = useState<string>(
        () => localStorage.getItem(MODEL_STORAGE_KEY) ?? '',
    )

    const bottomRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const stoppedRef = useRef(false)

    const models = useMemo(() => providers.flatMap((p) => p.models), [providers])

    const activeModelId = models.some((m) => m.id === modelId)
        ? modelId
        : (models[0]?.id ?? '')

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [turns, sending])

    useEffect(() => {
        if (activeModelId) localStorage.setItem(MODEL_STORAGE_KEY, activeModelId)
    }, [activeModelId])

    useEffect(() => () => abortRef.current?.abort(), [])

    const canSend = text.trim().length > 0 && !sending && Boolean(activeModelId)

    async function handleSend() {
        if (!canSend) return
        const message = text.trim()
        const history: DesignerMessage[] = turns.map((t) => ({
            role: t.role,
            content: t.content,
        }))

        setText('')
        setError(null)
        setTurns((prev) => [...prev, turn('user', message)])
        setSending(true)

        const controller = new AbortController()
        abortRef.current = controller
        stoppedRef.current = false

        try {
            const result = await designWorkflow(
                { message, llm_model_id: activeModelId, workflow: getGraph(), history },
                controller.signal,
            )
            if (result.workflow) onApply(result.workflow)
            setTurns((prev) => [
                ...prev,
                {
                    ...turn('assistant', result.reply),
                    notes: result.notes,
                    applied: Boolean(result.workflow),
                },
            ])
        } catch (err: unknown) {
            if (stoppedRef.current) return
            setError(err instanceof Error ? err.message : 'The designer could not be reached')
        } finally {
            abortRef.current = null
            setSending(false)
        }
    }

    function handleStop() {
        stoppedRef.current = true
        abortRef.current?.abort()
        setSending(false)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void handleSend()
        }
    }

    return (
        <div className="h-full flex flex-col bg-zinc-950">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                <IoSparklesOutline className="text-amber-400 shrink-0" />
                <span className="text-sm text-zinc-300">Designer</span>
                {turns.length > 0 && (
                    <button
                        className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
                        onClick={() => {
                            setTurns([])
                            setError(null)
                        }}
                        title="Start a new designer conversation"
                    >
                        <IoRefreshOutline /> New
                    </button>
                )}
                <button
                    className={`text-zinc-500 hover:text-zinc-300 ${turns.length > 0 ? '' : 'ml-auto'}`}
                    onClick={onClose}
                    aria-label="Close the designer"
                >
                    <IoCloseOutline size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
                {turns.length === 0 && (
                    <div className="flex flex-col gap-2 text-[11px] text-zinc-500">
                        <p className="leading-relaxed">
                            Describe the workflow you want and it gets drafted onto the canvas.
                            Nothing is saved until you press Save, so you can keep asking for
                            changes or edit the result by hand.
                        </p>
                        {EXAMPLES.map((example) => (
                            <button
                                key={example}
                                className="text-left text-zinc-400 border border-zinc-800 rounded px-2 py-1.5 hover:border-zinc-600 hover:text-zinc-300 leading-snug"
                                onClick={() => setText(example)}
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                )}

                {turns.map((t) =>
                    t.role === 'user' ? (
                        <div key={t.id} className="self-end max-w-[85%] bg-zinc-800 text-zinc-200 text-xs rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                            {t.content}
                        </div>
                    ) : (
                        <div key={t.id} className="flex flex-col gap-1.5">
                            <div className="text-xs text-zinc-300 leading-relaxed wf-designer-reply">
                                <Markdown remarkPlugins={[remarkGfm]}>{t.content}</Markdown>
                            </div>
                            {t.applied && (
                                <span className="self-start text-[10px] text-amber-400 border border-amber-700/50 bg-amber-950/30 rounded px-1.5 py-0.5">
                                    Drafted onto the canvas — review, then Save
                                </span>
                            )}
                            {t.notes.length > 0 && (
                                <ul className="flex flex-col gap-1 text-[10px] text-zinc-500 border-l border-zinc-800 pl-2">
                                    {t.notes.map((note) => (
                                        <li key={note} className="flex gap-1 leading-snug">
                                            <IoWarningOutline className="mt-px shrink-0 text-zinc-600" />
                                            {note}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ),
                )}

                {sending && (
                    <div className="text-[11px] text-zinc-500 animate-pulse">
                        Designing… this can take a while on a local model.
                    </div>
                )}
                {error && <div className="text-[11px] text-red-400">{error}</div>}
                <div ref={bottomRef} />
            </div>

            <div className="border-t border-zinc-800 p-2 flex flex-col gap-2">
                <textarea
                    className="w-full bg-zinc-900 border border-zinc-800 rounded text-zinc-200 text-xs px-2 py-1.5 outline-none focus:border-zinc-600 resize-none placeholder:text-zinc-600"
                    rows={3}
                    placeholder={
                        models.length === 0
                            ? 'Add an AI provider first — the designer needs a model to think with.'
                            : 'Describe the workflow, or the change you want…'
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={models.length === 0}
                />
                <div className="flex items-center gap-2">
                    <select
                        className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 text-[11px] px-1.5 py-1 outline-none focus:border-zinc-600"
                        value={activeModelId}
                        onChange={(e) => setModelId(e.target.value)}
                        title="The model the designer thinks with"
                    >
                        {models.length === 0 && <option value="">No models available</option>}
                        {providers
                            .filter((p) => p.models.length > 0)
                            .map((p) => (
                                <optgroup key={p.id} label={p.provider_name}>
                                    {p.models.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.model_name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                    </select>
                    {sending ? (
                        <button
                            className="flex items-center gap-1 text-[11px] text-zinc-300 border border-zinc-700 rounded px-2 py-1 hover:border-zinc-500"
                            onClick={handleStop}
                        >
                            <IoStopCircleOutline /> Stop
                        </button>
                    ) : (
                        <button
                            className={`p-1.5 rounded text-white ${canSend ? 'bg-amber-600 hover:bg-amber-700' : 'bg-zinc-800 cursor-not-allowed'}`}
                            onClick={() => void handleSend()}
                            disabled={!canSend}
                            aria-label="Send to the designer"
                        >
                            <IoArrowUp />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function turn(role: Turn['role'], content: string): Turn {
    return { id: crypto.randomUUID(), role, content, notes: [], applied: false }
}
