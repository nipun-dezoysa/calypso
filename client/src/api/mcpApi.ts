import axiosInstance from './axiosInstance'

export type McpTransport = 'stdio' | 'streamable_http' | 'sse' | 'websocket'

export interface McpServer {
    id: string
    name: string
    transport: McpTransport
    command: string | null
    args: string[]
    env: Record<string, string>
    cwd: string | null
    url: string | null
    headers: Record<string, string>
    enabled: boolean
    description: string | null
    created_at: string
    updated_at: string
}

export interface McpServerCreate {
    name: string
    transport: McpTransport
    command?: string | null
    args?: string[]
    env?: Record<string, string>
    cwd?: string | null
    url?: string | null
    headers?: Record<string, string>
    enabled?: boolean
    description?: string | null
}

export interface McpServerUpdate {
    name?: string | null
    transport?: McpTransport | null
    command?: string | null
    args?: string[] | null
    env?: Record<string, string> | null
    cwd?: string | null
    url?: string | null
    headers?: Record<string, string> | null
    enabled?: boolean | null
    description?: string | null
}

export interface McpToolInfo {
    name: string
    description: string | null
}

export interface McpTestResult {
    ok: boolean
    tool_count: number
    tools: McpToolInfo[]
    error: string | null
}

export interface ListParams {
    skip?: number
    limit?: number
}

// Create/list use a trailing slash to match the backend router mount.
const BASE = '/api/v1/mcp-servers'

export async function listMcpServers(params?: ListParams): Promise<McpServer[]> {
    const response = await axiosInstance.get<McpServer[]>(`${BASE}/`, { params })
    return response.data
}

export async function createMcpServer(data: McpServerCreate): Promise<McpServer> {
    const response = await axiosInstance.post<McpServer>(`${BASE}/`, data)
    return response.data
}

export async function getMcpServer(serverId: string): Promise<McpServer> {
    const response = await axiosInstance.get<McpServer>(`${BASE}/${serverId}`)
    return response.data
}

export async function updateMcpServer(
    serverId: string,
    data: McpServerUpdate,
): Promise<McpServer> {
    const response = await axiosInstance.patch<McpServer>(`${BASE}/${serverId}`, data)
    return response.data
}

export async function deleteMcpServer(serverId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/${serverId}`)
}

export async function testMcpServer(serverId: string): Promise<McpTestResult> {
    // Connecting may spawn a process / reach a remote server; allow extra time.
    const response = await axiosInstance.post<McpTestResult>(
        `${BASE}/${serverId}/test`,
        undefined,
        { timeout: 30_000 },
    )
    return response.data
}
