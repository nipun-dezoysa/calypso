import axiosInstance from './axiosInstance'

export type GraphDbProvider = 'neo4j'

export interface GraphDb {
    id: string
    name: string
    provider: GraphDbProvider
    uri: string
    username: string | null
    /** The password itself is never sent back, only whether one is stored. */
    password_set: boolean
    database: string | null
    read_only: boolean
    query_timeout: number
    max_rows: number
    enabled: boolean
    description: string | null
    created_at: string
    updated_at: string
}

export interface GraphDbCreate {
    name: string
    provider: GraphDbProvider
    uri: string
    username?: string | null
    password?: string | null
    database?: string | null
    read_only?: boolean
    query_timeout?: number
    max_rows?: number
    enabled?: boolean
    description?: string | null
}

export interface GraphDbUpdate {
    name?: string | null
    provider?: GraphDbProvider | null
    uri?: string | null
    username?: string | null
    /** Omit to keep the stored password; send '' to clear it. */
    password?: string | null
    database?: string | null
    read_only?: boolean | null
    query_timeout?: number | null
    max_rows?: number | null
    enabled?: boolean | null
    description?: string | null
}

export interface GraphNodeInfo {
    label: string
    properties: string[]
}

export interface GraphRelationshipInfo {
    type: string
    properties: string[]
}

export interface GraphSchemaInfo {
    nodes: GraphNodeInfo[]
    relationships: GraphRelationshipInfo[]
    patterns: string[]
}

export interface GraphDbTestResult {
    ok: boolean
    node_label_count: number
    relationship_type_count: number
    graph_schema: GraphSchemaInfo | null
    error: string | null
}

export interface ListParams {
    skip?: number
    limit?: number
}

// Create/list use a trailing slash to match the backend router mount.
const BASE = '/api/v1/graph-databases'

export async function listGraphDbs(params?: ListParams): Promise<GraphDb[]> {
    const response = await axiosInstance.get<GraphDb[]>(`${BASE}/`, { params })
    return response.data
}

export async function createGraphDb(data: GraphDbCreate): Promise<GraphDb> {
    const response = await axiosInstance.post<GraphDb>(`${BASE}/`, data)
    return response.data
}

export async function getGraphDb(graphDbId: string): Promise<GraphDb> {
    const response = await axiosInstance.get<GraphDb>(`${BASE}/${graphDbId}`)
    return response.data
}

export async function updateGraphDb(
    graphDbId: string,
    data: GraphDbUpdate,
): Promise<GraphDb> {
    const response = await axiosInstance.patch<GraphDb>(`${BASE}/${graphDbId}`, data)
    return response.data
}

export async function deleteGraphDb(graphDbId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/${graphDbId}`)
}

export async function testGraphDb(graphDbId: string): Promise<GraphDbTestResult> {
    // Connecting reaches a remote database and reads its schema; allow extra time.
    const response = await axiosInstance.post<GraphDbTestResult>(
        `${BASE}/${graphDbId}/test`,
        undefined,
        { timeout: 30_000 },
    )
    return response.data
}
