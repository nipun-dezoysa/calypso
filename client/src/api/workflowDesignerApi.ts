import axiosInstance from './axiosInstance'
import type {
    WorkflowAgentNode,
    WorkflowCondition,
    WorkflowEdge,
    WorkflowNode,
    WorkflowReplace,
} from './workflowApi'

/** The graph as it stands on the canvas. Sent up on every turn, unfinished bits
 *  and all. Asking the designer to fix a half-built workflow is the point, so
 *  the server validates nothing on the way in. Shape-identical to a save
 *  payload, which is why the canvas serialises once for both. */
export type DesignerDraft = WorkflowReplace

export interface DesignerMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface DesignRequest {
    message: string
    /** The model the designer itself thinks with, not the one the workflow runs on. */
    llm_model_id: string
    workflow: DesignerDraft
    history: DesignerMessage[]
}

/** A complete graph, already validated server-side against the save rules, so
 *  it can go onto the canvas and be saved untouched. */
export interface ProposedWorkflow {
    name: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    conditions: WorkflowCondition[]
    agent_nodes: WorkflowAgentNode[]
}

export interface DesignResponse {
    reply: string
    workflow: ProposedWorkflow | null
    /** Fixes the server applied to the designer's answer, worth showing. */
    notes: string[]
}

const BASE = '/api/v1/workflow-designer'

// Designing a graph is a long single generation, and a local model on CPU can
// sit on it for minutes. The panel offers a stop button rather than relying on
// this, but it has to be far past the 15s default either way.
const DESIGN_TIMEOUT_MS = 600_000

export async function designWorkflow(
    data: DesignRequest,
    signal?: AbortSignal,
): Promise<DesignResponse> {
    const response = await axiosInstance.post<DesignResponse>(`${BASE}/design`, data, {
        timeout: DESIGN_TIMEOUT_MS,
        signal,
    })
    return response.data
}
