import { useState } from 'react'

export interface AgentFormOptions {
    initialName?: string
    initialLlmModelId?: string
    initialAgentInstructions?: string
    initialCreativity?: number
    initialMarkdownEnabled?: boolean
    initialCollectionIds?: string[]
    initialMcpServerIds?: string[]
}

export interface AgentFormValues {
    name: string
    llm_model_id: string
    agent_instructions: string
    creativity: number
    markdown_enabled: boolean
    collection_ids: string[]
    mcp_server_ids: string[]
}

export interface AgentFormHandle {
    name: string
    setName: (v: string) => void
    llmModelId: string
    setLlmModelId: (v: string) => void
    agentInstructions: string
    setAgentInstructions: (v: string) => void
    creativity: number
    setCreativity: (v: number) => void
    markdownEnabled: boolean
    setMarkdownEnabled: (v: boolean) => void
    collectionIds: string[]
    toggleCollection: (id: string) => void
    mcpServerIds: string[]
    toggleMcpServer: (id: string) => void
    errors: Record<string, string>
    setErrors: (fn: (prev: Record<string, string>) => Record<string, string>) => void
    validate: () => boolean
    formValues: AgentFormValues
}

export function useAgentForm(options?: AgentFormOptions): AgentFormHandle {
    const [name, setName] = useState(options?.initialName ?? '')
    const [llmModelId, setLlmModelId] = useState(options?.initialLlmModelId ?? '')
    const [agentInstructions, setAgentInstructions] = useState(
        options?.initialAgentInstructions ?? '',
    )
    const [creativity, setCreativity] = useState(options?.initialCreativity ?? 50)
    const [markdownEnabled, setMarkdownEnabled] = useState(
        options?.initialMarkdownEnabled ?? false,
    )
    const [collectionIds, setCollectionIds] = useState<string[]>(
        options?.initialCollectionIds ?? [],
    )
    const [mcpServerIds, setMcpServerIds] = useState<string[]>(
        options?.initialMcpServerIds ?? [],
    )
    const [errors, setErrors] = useState<Record<string, string>>({})

    function toggleCollection(id: string) {
        setCollectionIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
        )
    }

    function toggleMcpServer(id: string) {
        setMcpServerIds((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
        )
    }

    function validate(): boolean {
        const errs: Record<string, string> = {}
        if (!name.trim()) errs.name = 'Agent name is required.'
        if (!llmModelId) errs.llm_model_id = 'Select a model for this agent.'
        if (!agentInstructions.trim()) errs.agent_instructions = 'Instructions are required.'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const formValues: AgentFormValues = {
        name: name.trim(),
        llm_model_id: llmModelId,
        agent_instructions: agentInstructions.trim(),
        creativity,
        markdown_enabled: markdownEnabled,
        collection_ids: collectionIds,
        mcp_server_ids: mcpServerIds,
    }

    return {
        name, setName,
        llmModelId, setLlmModelId,
        agentInstructions, setAgentInstructions,
        creativity, setCreativity,
        markdownEnabled, setMarkdownEnabled,
        collectionIds, toggleCollection,
        mcpServerIds, toggleMcpServer,
        errors, setErrors,
        validate, formValues,
    }
}
