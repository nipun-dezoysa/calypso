import { IoCheckmark } from 'react-icons/io5'
import type { AIProvider } from '../../api/aiProviderApi'
import type { Collection } from '../../api/kbApi'
import type { McpServer } from '../../api/mcpApi'
import type { AgentFormHandle } from './useAgentForm'
import './mcp.css'

interface AgentFormFieldsProps {
    form: AgentFormHandle
    providers: AIProvider[]
    collections: Collection[]
    mcpServers: McpServer[]
}

const CREATIVITY_LABELS = ['Precise', 'Balanced', 'Creative'] as const

function creativityLabel(value: number): string {
    if (value < 34) return CREATIVITY_LABELS[0]
    if (value < 67) return CREATIVITY_LABELS[1]
    return CREATIVITY_LABELS[2]
}

function AgentFormFields({ form, providers, collections, mcpServers }: AgentFormFieldsProps) {
    const {
        name, setName,
        llmModelId, setLlmModelId,
        agentInstructions, setAgentInstructions,
        creativity, setCreativity,
        markdownEnabled, setMarkdownEnabled,
        collectionIds, toggleCollection,
        mcpServerIds, toggleMcpServer,
        errors, setErrors,
    } = form

    const providersWithModels = providers.filter((p) => p.models.length > 0)

    return (
        <>
            <div className="form-field">
                <label className="form-label" htmlFor="af-name">
                    Agent Name
                    <span className="form-label-required">* required</span>
                </label>
                <input
                    id="af-name"
                    className="form-input"
                    placeholder="e.g. Support Bot"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value)
                        setErrors((prev) => ({ ...prev, name: '' }))
                    }}
                    autoComplete="off"
                    spellCheck={false}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-field">
                <label className="form-label" htmlFor="af-model">
                    Model
                    <span className="form-label-required">* required</span>
                </label>
                <select
                    id="af-model"
                    className="form-input"
                    value={llmModelId}
                    onChange={(e) => {
                        setLlmModelId(e.target.value)
                        setErrors((prev) => ({ ...prev, llm_model_id: '' }))
                    }}
                >
                    <option value="" disabled>
                        {providersWithModels.length === 0
                            ? 'No models available — add a provider first'
                            : 'Select a model…'}
                    </option>
                    {providersWithModels.map((provider) => (
                        <optgroup key={provider.id} label={provider.provider_name}>
                            {provider.models.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.model_name}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {errors.llm_model_id && <div className="form-error">{errors.llm_model_id}</div>}
            </div>

            <div className="form-field">
                <label className="form-label" htmlFor="af-instructions">
                    Instructions
                    <span className="form-label-required">* required</span>
                </label>
                <textarea
                    id="af-instructions"
                    className="form-input"
                    rows={5}
                    placeholder="Describe how this agent should behave, its role, tone, and constraints…"
                    value={agentInstructions}
                    onChange={(e) => {
                        setAgentInstructions(e.target.value)
                        setErrors((prev) => ({ ...prev, agent_instructions: '' }))
                    }}
                    spellCheck={true}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                {errors.agent_instructions && (
                    <div className="form-error">{errors.agent_instructions}</div>
                )}
            </div>

            <div className="form-field">
                <label className="form-label" htmlFor="af-creativity">
                    Creativity
                    <span className="form-label-optional">{creativity} · {creativityLabel(creativity)}</span>
                </label>
                <input
                    id="af-creativity"
                    className="form-range"
                    type="range"
                    min={0}
                    max={100}
                    value={creativity}
                    onChange={(e) => setCreativity(Number(e.target.value))}
                />
                <div className="form-range-scale">
                    <span>Precise</span>
                    <span>Creative</span>
                </div>
            </div>

            <div className="form-field">
                <label className="mcp-toggle">
                    <input
                        type="checkbox"
                        checked={markdownEnabled}
                        onChange={(e) => setMarkdownEnabled(e.target.checked)}
                    />
                    <span>Format responses with Markdown</span>
                </label>
            </div>

            <div className="form-field">
                <label className="form-label">
                    Knowledgebases
                    <span className="form-label-optional">optional</span>
                </label>
                {collections.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#71717a', fontStyle: 'italic' }}>
                        No knowledgebases yet — create one in the Knowledgebases panel.
                    </p>
                ) : (
                    <>
                        <p style={{ fontSize: 11, color: '#52525b', marginBottom: 5 }}>
                            Attach collections this agent can retrieve context from — click to toggle:
                        </p>
                        <div className="form-model-pills">
                            {collections.map((c) => {
                                const on = collectionIds.includes(c.id)
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className={`form-model-pill ${on ? 'form-model-pill--on' : ''}`}
                                        onClick={() => toggleCollection(c.id)}
                                        title={c.description ?? c.name}
                                    >
                                        {on && <IoCheckmark style={{ marginRight: 3, fontSize: 10 }} />}
                                        {c.name}
                                        <span style={{ marginLeft: 5, opacity: 0.6, fontSize: 10 }}>
                                            {c.document_count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            <div className="form-field">
                <label className="form-label">
                    MCP Servers
                    <span className="form-label-optional">optional</span>
                </label>
                {mcpServers.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#71717a', fontStyle: 'italic' }}>
                        No MCP servers yet — add one in the MCPs panel.
                    </p>
                ) : (
                    <>
                        <p style={{ fontSize: 11, color: '#52525b', marginBottom: 5 }}>
                            Attach MCP servers whose tools this agent can call — click to toggle:
                        </p>
                        <div className="form-model-pills">
                            {mcpServers.map((s) => {
                                const on = mcpServerIds.includes(s.id)
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className={`form-model-pill ${on ? 'form-model-pill--on' : ''}`}
                                        onClick={() => toggleMcpServer(s.id)}
                                        title={`${s.transport}${s.enabled ? '' : ' · disabled'}`}
                                    >
                                        {on && <IoCheckmark style={{ marginRight: 3, fontSize: 10 }} />}
                                        {s.name}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

export default AgentFormFields
