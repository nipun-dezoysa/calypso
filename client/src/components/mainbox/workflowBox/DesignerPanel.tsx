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
import AutoGrowTextarea from '../../common/AutoGrowTextarea'
import ScrollArea from '../../common/ScrollArea'
import { Button } from '../../ui/button'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '../../ui/select'
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
        <div data-tour="wf-designer-panel" className="h-full flex flex-col bg-(--c-bg)">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-(--c-hover)">
                <IoSparklesOutline className="text-(--c-accent-hi) shrink-0" />
                <span className="text-sm text-(--c-text-body)">Designer</span>
                {turns.length > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-auto gap-1 px-1.5 py-1 text-[11px] font-normal text-(--c-text-muted) hover:text-(--c-text-body)"
                        onClick={() => {
                            setTurns([])
                            setError(null)
                        }}
                        title="Start a new designer conversation"
                    >
                        <IoRefreshOutline /> New
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 text-(--c-text-muted) hover:text-(--c-text-body) ${turns.length > 0 ? '' : 'ml-auto'}`}
                    onClick={onClose}
                    aria-label="Close the designer"
                >
                    <IoCloseOutline size={18} />
                </Button>
            </div>

            <ScrollArea
                className="flex-1"
                viewportClassName="px-3 py-3"
                contentClassName="flex flex-col gap-3"
            >
                {turns.length === 0 && (
                    <div className="flex flex-col gap-2 text-[11px] text-(--c-text-muted)">
                        <p className="leading-relaxed">
                            Describe the workflow you want and it gets drafted onto the canvas.
                            Nothing is saved until you press Save, so you can keep asking for
                            changes or edit the result by hand.
                        </p>
                        {EXAMPLES.map((example) => (
                            <Button
                                key={example}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto justify-start whitespace-normal text-left text-[11px] font-normal text-(--c-text-dim) px-2 py-1.5 hover:border-(--c-text-subtle) hover:text-(--c-text-body) leading-snug"
                                onClick={() => setText(example)}
                            >
                                {example}
                            </Button>
                        ))}
                    </div>
                )}

                {turns.map((t) =>
                    t.role === 'user' ? (
                        <div key={t.id} className="self-end max-w-[85%] bg-(--c-hover) text-(--c-text) text-xs rounded-md px-2.5 py-1.5 whitespace-pre-wrap">
                            {t.content}
                        </div>
                    ) : (
                        <div key={t.id} className="flex flex-col gap-1.5">
                            <div className="text-xs text-(--c-text-body) leading-relaxed wf-designer-reply">
                                <Markdown remarkPlugins={[remarkGfm]}>{t.content}</Markdown>
                            </div>
                            {t.applied && (
                                <span className="self-start text-[10px] text-(--c-accent-hi) border border-(--c-accent-lo)/50 bg-(--c-accent)/30 rounded px-1.5 py-0.5">
                                    Drafted onto the canvas. Review, then Save
                                </span>
                            )}
                            {t.notes.length > 0 && (
                                <ul className="flex flex-col gap-1 text-[10px] text-(--c-text-muted) border-l border-(--c-hover) pl-2">
                                    {t.notes.map((note) => (
                                        <li key={note} className="flex gap-1 leading-snug">
                                            <IoWarningOutline className="mt-px shrink-0 text-(--c-text-subtle)" />
                                            {note}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ),
                )}

                {sending && (
                    <div className="text-[11px] text-(--c-text-muted) animate-pulse">
                        Designing… this can take a while on a local model.
                    </div>
                )}
                {error && <div className="text-[11px] text-(--c-danger-text)">{error}</div>}
                <div ref={bottomRef} />
            </ScrollArea>

            <div className="shrink-0 border-t border-(--c-hover) p-2 flex flex-col gap-2">
                <AutoGrowTextarea
                    data-tour="wf-designer-input"
                    className="bg-(--c-surface) border border-(--c-hover) rounded text-(--c-text) text-xs px-2 py-1.5 outline-none focus:border-(--c-text-subtle) placeholder:text-(--c-text-subtle)"
                    minRows={3}
                    maxHeight={180}
                    placeholder={
                        models.length === 0
                            ? 'Add an AI provider first. The designer needs a model to think with.'
                            : 'Describe the workflow, or the change you want…'
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={models.length === 0}
                />
                <div className="flex items-center gap-2">
                    <Select
                        value={activeModelId || undefined}
                        onValueChange={(value) => setModelId(value)}
                        disabled={models.length === 0}
                    >
                        <SelectTrigger
                            data-tour="wf-designer-model"
                            className="flex-1 min-w-0 h-7 text-[11px] px-1.5 text-(--c-text-dim)"
                            title="The model the designer thinks with"
                        >
                            <SelectValue placeholder="No models available" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers
                                .filter((p) => p.models.length > 0)
                                .map((p) => (
                                    <SelectGroup key={p.id}>
                                        <SelectLabel>{p.provider_name}</SelectLabel>
                                        {p.models.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.model_name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                        </SelectContent>
                    </Select>
                    {sending ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[11px] text-(--c-text-body) hover:border-(--c-text-muted)"
                            onClick={handleStop}
                        >
                            <IoStopCircleOutline /> Stop
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="icon"
                            className={`h-8 w-8 rounded text-white ${canSend ? 'bg-(--c-accent) hover:bg-(--c-accent-lo)' : 'bg-(--c-hover) text-(--c-text-muted) cursor-not-allowed hover:bg-(--c-hover)'}`}
                            onClick={() => void handleSend()}
                            disabled={!canSend}
                            aria-label="Send to the designer"
                        >
                            <IoArrowUp />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

function turn(role: Turn['role'], content: string): Turn {
    return { id: crypto.randomUUID(), role, content, notes: [], applied: false }
}
