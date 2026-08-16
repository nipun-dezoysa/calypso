import { IoCheckmark } from 'react-icons/io5'
import type { AIProvider } from '../../../api/aiProviderApi'
import type { Agent } from '../../../api/agentApi'
import type { Collection } from '../../../api/kbApi'
import type { McpServer } from '../../../api/mcpApi'
import type { AgentConfig } from './workflowTypes'

interface AgentNodeEditorProps {
    config: AgentConfig
    onChange: (changes: Partial<AgentConfig>) => void
    agents: Agent[]
    providers: AIProvider[]
    collections: Collection[]
    mcpServers: McpServer[]
}

const FIELD =
    'w-full bg-(--c-surface) border border-(--c-border) rounded text-(--c-text) text-[11px] px-1.5 py-1 outline-none focus:border-(--c-text-muted)'
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

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <label className={LABEL}>Node name</label>
                <input
                    className={FIELD}
                    value={config.name}
                    placeholder="e.g. Triage"
                    onChange={(e) => onChange({ name: e.target.value })}
                    spellCheck={false}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className={LABEL}>Base agent</label>
                <select
                    className={FIELD}
                    value={config.agent_id ?? ''}
                    onChange={(e) => onChange({ agent_id: e.target.value || null })}
                >
                    <option value="">None — configure below</option>
                    {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
                <p className={HINT}>
                    Optional. Its model, instructions, knowledgebases and MCP servers become this
                    node's starting point; anything you set below layers on top.
                </p>
            </div>

            <div className="flex flex-col gap-1">
                <label className={LABEL}>Model {base && <span className="text-(--c-text-subtle)">· override</span>}</label>
                <select
                    className={FIELD}
                    value={config.llm_model_id ?? ''}
                    onChange={(e) => onChange({ llm_model_id: e.target.value || null })}
                >
                    <option value="">
                        {providersWithModels.length === 0
                            ? 'No models — add a provider first'
                            : modelPlaceholder}
                    </option>
                    {providersWithModels.map((p) => (
                        <optgroup key={p.id} label={p.provider_name}>
                            {p.models.map((m) => (
                                <option key={m.id} value={m.id}>{m.model_name}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {!base && !config.llm_model_id && (
                    <span className="text-[10px] text-(--c-danger-text)">
                        Pick a model, or a base agent to take one from.
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <label className={LABEL}>Node instructions</label>
                <textarea
                    className={FIELD}
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
                <label className={LABEL}>Output instructions</label>
                <textarea
                    className={FIELD}
                    rows={3}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    value={config.output_instructions}
                    placeholder="How to shape what gets handed to the next node…"
                    onChange={(e) => onChange({ output_instructions: e.target.value })}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className={LABEL}>
                    Creativity
                    <span className="ml-1 text-(--c-text-subtle)">
                        {creativity}
                        {config.creativity === null && base ? ' · inherited' : ''}
                    </span>
                </label>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={creativity}
                    className="w-full accent-(--c-accent)"
                    onChange={(e) => onChange({ creativity: Number(e.target.value) })}
                />
                {config.creativity !== null && (
                    <button
                        className="self-start text-[10px] text-(--c-text-muted) hover:text-(--c-text-body)"
                        onClick={() => onChange({ creativity: null })}
                    >
                        Reset to {base ? 'the base agent' : 'default'}
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <label className={LABEL}>Knowledgebases</label>
                {collections.length === 0 ? (
                    <p className={HINT}>None yet — create one in the Knowledgebases panel.</p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {collections.map((c) => {
                            const on = config.collection_ids.includes(c.id)
                            const inherited = base?.collections.some((x) => x.id === c.id)
                            return (
                                <button
                                    key={c.id}
                                    className={`flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 border ${
                                        on
                                            ? 'border-(--c-accent) text-(--c-accent-hi) bg-(--c-accent)/30'
                                            : 'border-(--c-border) text-(--c-text-dim) hover:border-(--c-text-muted)'
                                    }`}
                                    onClick={() =>
                                        onChange({ collection_ids: toggle(config.collection_ids, c.id) })
                                    }
                                    title={inherited ? 'Already provided by the base agent' : c.name}
                                >
                                    {on && <IoCheckmark />}
                                    {c.name}
                                    {inherited && <span className="text-(--c-text-subtle)">·base</span>}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <label className={LABEL}>MCP servers</label>
                {mcpServers.length === 0 ? (
                    <p className={HINT}>None yet — add one in the MCPs panel.</p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {mcpServers.map((s) => {
                            const on = config.mcp_server_ids.includes(s.id)
                            const inherited = base?.mcp_servers.some((x) => x.id === s.id)
                            return (
                                <button
                                    key={s.id}
                                    className={`flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 border ${
                                        on
                                            ? 'border-(--c-accent) text-(--c-accent-hi) bg-(--c-accent)/30'
                                            : 'border-(--c-border) text-(--c-text-dim) hover:border-(--c-text-muted)'
                                    }`}
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
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
