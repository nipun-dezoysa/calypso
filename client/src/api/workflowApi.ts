import axiosInstance from './axiosInstance'

export type NodeType = 'agent' | 'condition'

export type ConditionOperator =
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'starts_with'
    | 'ends_with'
    | 'regex'
    | 'always'

export interface WorkflowNode {
    id: string
    type: NodeType
    i_id: string | null
    is_start: boolean
    position_x: number
    position_y: number
}

export interface WorkflowEdge {
    id: string
    source: string
    target: string
    source_handle: string | null
}

export interface WorkflowCondition {
    id: string
    n_id: string
    label: string
    operator: ConditionOperator
    value: string | null
    case_sensitive: boolean
    order_index: number
}

export interface Workflow {
    id: string
    name: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    conditions: WorkflowCondition[]
    created_at: string
    updated_at: string
}

export interface WorkflowSummary {
    id: string
    name: string
    node_count: number
    created_at: string
    updated_at: string
}

export interface NodeInput {
    id: string
    type: NodeType
    i_id?: string | null
    is_start: boolean
    position_x: number
    position_y: number
}

export interface EdgeInput {
    id?: string | null
    source: string
    target: string
    source_handle?: string | null
}

export interface ConditionInput {
    id: string
    n_id: string
    label: string
    operator: ConditionOperator
    value: string | null
    case_sensitive: boolean
    order_index: number
}

export interface WorkflowCreate {
    name: string
    nodes?: NodeInput[]
    edges?: EdgeInput[]
    conditions?: ConditionInput[]
}

export interface WorkflowReplace {
    name: string
    nodes: NodeInput[]
    edges: EdgeInput[]
    conditions: ConditionInput[]
}

export interface ListParams {
    skip?: number
    limit?: number
}

const BASE = '/api/v1/workflows'

export async function listWorkflows(params?: ListParams): Promise<WorkflowSummary[]> {
    const response = await axiosInstance.get<WorkflowSummary[]>(`${BASE}/`, { params })
    return response.data
}

export async function createWorkflow(data: WorkflowCreate): Promise<Workflow> {
    const response = await axiosInstance.post<Workflow>(`${BASE}/`, data)
    return response.data
}

export async function getWorkflow(workflowId: string): Promise<Workflow> {
    const response = await axiosInstance.get<Workflow>(`${BASE}/${workflowId}`)
    return response.data
}

export async function replaceWorkflow(
    workflowId: string,
    data: WorkflowReplace,
): Promise<Workflow> {
    const response = await axiosInstance.put<Workflow>(`${BASE}/${workflowId}`, data)
    return response.data
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/${workflowId}`)
}
