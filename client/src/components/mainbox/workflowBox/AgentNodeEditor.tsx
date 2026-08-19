import { IoCheckmark } from 'react-icons/io5'
import type { AIProvider } from '../../../api/aiProviderApi'
import type { Agent } from '../../../api/agentApi'
import type { Collection } from '../../../api/kbApi'
import type { McpServer } from '../../../api/mcpApi'
import type { AgentConfig } from './workflowTypes'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Slider } from '../../ui/slider'
import { Checkbox } from '../../ui/checkbox'
import { Label } from '../../ui/label'
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

interface AgentNodeEditorProps {
    config: AgentConfig
    onChange: (changes: Partial<AgentConfig>) => void
    agents: Agent[]
    providers: AIProvider[]
    collections: Collection[]
    mcpServers: McpServer[]
}

const NO_AGENT = '__none__'
const NO_MODEL = '__none__'

const SELECT_TRIGGER = 'w-full h-7 text-[11px] px-2'
const LABEL = 'text-[11px] text-(--c-text-muted)'
const HINT = 'text-[10px] text-(--c-text-subtle) leading-snug'

function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export default function AgentNodeEditor({
    config,
    onChange,
    agents,
    providers,
    collections,
    mcpServers,
}: AgentNodeEditorProps) {
    const base = agents.find((a) => a.id === config.agent_id) ?? null
    const providersWithModels = providers.filter((p) => p.models.length > 0)

    // With a base agent, its own settings fill the gaps this node leaves blank.
    const modelPlaceholder = base
        ? `Inherit from ${base.name} (${base.llm_model.model_name})`
        : 'Select a model…'
    const creativity = config.creativity ?? base?.creativity ?? 50
    const markdownEnabled = config.markdown_enabled ?? base?.markdown_enabled ?? false

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <Label className={LABEL}>Node name</Label>
                <Input
                    className="h-7 text-[11px] px-2"
                    value={config.name}
                    placeholder="e.g. Triage"
                    onChange={(e) => onChange({ name: e.target.value })}
                    spellCheck={false}
                />
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>Base agent</Label>
                <Select
                    value={config.agent_id ?? NO_AGENT}
                    onValueChange={(value) => onChange({ agent_id: value === NO_AGENT ? null : value })}
                >
                    <SelectTrigger className={SELECT_TRIGGER}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_AGENT}>None — configure below</SelectItem>
                        {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className={HINT}>
                    Optional. Its model, instructions, knowledgebases and MCP servers become this
                    node's starting point; anything you set below layers on top.
                </p>
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>Model {base && <span className="text-(--c-text-subtle)">· override</span>}</Label>
                <Select
                    value={config.llm_model_id ?? NO_MODEL}
                    onValueChange={(value) => onChange({ llm_model_id: value === NO_MODEL ? null : value })}
                >
                    <SelectTrigger className={SELECT_TRIGGER}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_MODEL}>
                            {providersWithModels.length === 0
                                ? 'No models — add a provider first'
                                : modelPlaceholder}
                        </SelectItem>
                        {providersWithModels.map((p) => (
                            <SelectGroup key={p.id}>
                                <SelectLabel>{p.provider_name}</SelectLabel>
                                {p.models.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>{m.model_name}</SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
                {!base && !config.llm_model_id && (
                    <span className="text-[10px] text-(--c-danger-text)">
                        Pick a model, or a base agent to take one from.
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>Node instructions</Label>
                <Textarea
                    className="text-[11px] px-2 py-1.5 min-h-0"
                    rows={4}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    value={config.node_instructions}
                    placeholder="What this step should do with what it receives…"
                    onChange={(e) => onChange({ node_instructions: e.target.value })}
                />
                {!base && !config.node_instructions.trim() && (
                    <span className="text-[10px] text-(--c-danger-text)">
                        Add instructions, or a base agent to take them from.
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>Output instructions</Label>
                <Textarea
                    className="text-[11px] px-2 py-1.5 min-h-0"
                    rows={3}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    value={config.output_instructions}
                    placeholder="How to shape what gets handed to the next node…"
                    onChange={(e) => onChange({ output_instructions: e.target.value })}
                />
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>
                    Creativity
                    <span className="ml-1 text-(--c-text-subtle)">
                        {creativity}
                        {config.creativity === null && base ? ' · inherited' : ''}
                    </span>
                </Label>
                <Slider
                    min={0}
                    max={100}
                    value={[creativity]}
                    onValueChange={([v]) => onChange({ creativity: v })}
                />
                {config.creativity !== null && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start h-auto p-0 text-[10px] font-normal text-(--c-text-muted) hover:text-(--c-text-body) hover:bg-transparent"
                        onClick={() => onChange({ creativity: null })}
                    >
                        Reset to {base ? 'the base agent' : 'default'}
                    </Button>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>
                    Markdown formatting
                    {config.markdown_enabled === null && base && (
                        <span className="ml-1 text-(--c-text-subtle)">
                            · inherited ({base.markdown_enabled ? 'on' : 'off'})
                        </span>
                    )}
                </Label>
                <Label className="flex items-center gap-2 text-[11px] font-normal text-(--c-text-dim) cursor-pointer">
                    <Checkbox
                        checked={markdownEnabled}
                        onCheckedChange={(checked) => onChange({ markdown_enabled: checked === true })}
                    />
                    Format responses with Markdown
                </Label>
                {config.markdown_enabled !== null && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start h-auto p-0 text-[10px] font-normal text-(--c-text-muted) hover:text-(--c-text-body) hover:bg-transparent"
                        onClick={() => onChange({ markdown_enabled: null })}
                    >
                        Reset to {base ? 'the base agent' : 'default'}
                    </Button>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>Knowledgebases</Label>
                {collections.length === 0 ? (
                    <p className={HINT}>None yet — create one in the Knowledgebases panel.</p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {collections.map((c) => {
                            const on = config.collection_ids.includes(c.id)
                            const inherited = base?.collections.some((x) => x.id === c.id)
                            return (
                                <Button
                                    key={c.id}
                                    type="button"
                                    variant={on ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-auto py-0.5 px-1.5 text-[10px] gap-0.5"
                                    onClick={() =>
                                        onChange({ collection_ids: toggle(config.collection_ids, c.id) })
                                    }
                                    title={inherited ? 'Already provided by the base agent' : c.name}
                                >
                                    {on && <IoCheckmark />}
                                    {c.name}
                                    {inherited && <span className="text-(--c-text-subtle)">·base</span>}
                                </Button>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <Label className={LABEL}>MCP servers</Label>
                {mcpServers.length === 0 ? (
                    <p className={HINT}>None yet — add one in the MCPs panel.</p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {mcpServers.map((s) => {
                            const on = config.mcp_server_ids.includes(s.id)
                            const inherited = base?.mcp_servers.some((x) => x.id === s.id)
                            return (
                                <Button
                                    key={s.id}
                                    type="button"
                                    variant={on ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-auto py-0.5 px-1.5 text-[10px] gap-0.5"
                                    onClick={() =>
                                        onChange({ mcp_server_ids: toggle(config.mcp_server_ids, s.id) })
                                    }
                                    title={
                                        inherited
                                            ? 'Already provided by the base agent'
                                            : `${s.transport}${s.enabled ? '' : ' · disabled'}`
                                    }
                                >
                                    {on && <IoCheckmark />}
                                    {s.name}
                                    {inherited && <span className="text-(--c-text-subtle)">·base</span>}
                                </Button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
