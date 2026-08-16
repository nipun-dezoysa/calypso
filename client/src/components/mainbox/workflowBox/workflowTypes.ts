import type { Node } from '@xyflow/react'
import type { ConditionOperator, NodeType } from '../../../api/workflowApi'

export interface Branch {
    id: string
    label: string
    operator: ConditionOperator
    value: string
    case_sensitive: boolean
}

export interface AgentConfig {
    id: string
    name: string
    agent_id: string | null
    llm_model_id: string | null
    node_instructions: string
    output_instructions: string
    creativity: number | null
    markdown_enabled: boolean | null
    collection_ids: string[]
    mcp_server_ids: string[]
}

export interface FlowNodeData extends Record<string, unknown> {
    kind: NodeType
    is_start: boolean
    agent: AgentConfig | null
    branches: Branch[]
    subtitle: string
}

export type FlowNode = Node<FlowNodeData>

export function newAgentConfig(): AgentConfig {
    return {
        id: crypto.randomUUID(),
        name: '',
        agent_id: null,
        llm_model_id: null,
        node_instructions: '',
        output_instructions: '',
        creativity: null,
        markdown_enabled: null,
        collection_ids: [],
        mcp_server_ids: [],
    }
}

export const OPERATORS: { value: ConditionOperator; label: string; short: string }[] = [
    { value: 'contains', label: 'contains', short: 'contains' },
    { value: 'not_contains', label: 'does not contain', short: 'lacks' },
    { value: 'equals', label: 'is exactly', short: 'is' },
    { value: 'not_equals', label: 'is not', short: 'is not' },
    { value: 'starts_with', label: 'starts with', short: 'starts' },
    { value: 'ends_with', label: 'ends with', short: 'ends' },
    { value: 'regex', label: 'matches regex', short: 'regex' },
    { value: 'always', label: 'anything (fallback)', short: '' },
]

const SHORT: Record<ConditionOperator, string> = Object.fromEntries(
    OPERATORS.map((o) => [o.value, o.short]),
) as Record<ConditionOperator, string>

export function branchSummary(branch: Branch): string {
    if (branch.operator === 'always') return 'anything else'
    return `${SHORT[branch.operator]} “${branch.value.trim() || '…'}”`
}

export function newBranch(overrides: Partial<Branch> = {}): Branch {
    return {
        id: crypto.randomUUID(),
        label: '',
        operator: 'contains',
        value: '',
        case_sensitive: false,
        ...overrides,
    }
}
