import type { Workflow, WorkflowCreate } from '../api/workflowApi'

/** Builds the create-payload for a copy of `workflow`, with every id
 *  regenerated so it can't collide with the source workflow's rows. */
export function buildDuplicatePayload(workflow: Workflow, newName: string): WorkflowCreate {
    const nodeIdMap = new Map(workflow.nodes.map((n) => [n.id, crypto.randomUUID()]))
    const conditionIdMap = new Map(workflow.conditions.map((c) => [c.id, crypto.randomUUID()]))

    return {
        name: newName,
        nodes: workflow.nodes.map((n) => ({
            ...n,
            id: nodeIdMap.get(n.id)!,
        })),
        edges: workflow.edges.map((e) => ({
            source: nodeIdMap.get(e.source) ?? e.source,
            target: nodeIdMap.get(e.target) ?? e.target,
            source_handle: e.source_handle
                ? (conditionIdMap.get(e.source_handle) ?? e.source_handle)
                : e.source_handle,
        })),
        conditions: workflow.conditions.map((c) => ({
            ...c,
            id: conditionIdMap.get(c.id)!,
            n_id: nodeIdMap.get(c.n_id) ?? c.n_id,
        })),
        agent_nodes: workflow.agent_nodes.map((a) => ({
            ...a,
            id: crypto.randomUUID(),
            n_id: nodeIdMap.get(a.n_id) ?? a.n_id,
        })),
    }
}
