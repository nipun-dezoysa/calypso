import type { ReactNode } from 'react'
import type { Node } from '@xyflow/react'
import type { ConditionOperator, NodeType } from '../../../api/workflowApi'

export interface Branch {
    id: string
    label: string
    operator: ConditionOperator
    value: string
    case_sensitive: boolean
}

export interface FlowNodeData extends Record<string, unknown> {
    kind: NodeType
    i_id: string | null
    is_start: boolean
    label: ReactNode
    branches: Branch[]
}

export type FlowNode = Node<FlowNodeData>

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
