import axiosInstance from './axiosInstance'

export interface AgentLLMModelInfo {
    id: string
    model_name: string
    ai_provider_id: string
    provider_name: string
}

export interface AgentCollectionInfo {
    id: string
    name: string
}

export interface AgentMcpServerInfo {
    id: string
    name: string
    transport: string
    enabled: boolean
}

export interface AgentCreate {
    name: string
    llm_model_id: string
    agent_instructions: string
    creativity?: number
    collection_ids?: string[]
    mcp_server_ids?: string[]
}

export interface AgentUpdate {
    name?: string | null
    llm_model_id?: string | null
    agent_instructions?: string | null
    creativity?: number | null
    collection_ids?: string[] | null
    mcp_server_ids?: string[] | null
}

export interface Agent {
    id: string
    name: string
    llm_model_id: string
    llm_model: AgentLLMModelInfo
    agent_instructions: string
    creativity: number
    collections: AgentCollectionInfo[]
    mcp_servers: AgentMcpServerInfo[]
    created_at: string
    updated_at: string
}

export interface ListAgentsParams {
    skip?: number
    limit?: number
}

const BASE = '/api/v1/agents'

export async function createAgent(data: AgentCreate): Promise<Agent> {
    const response = await axiosInstance.post<Agent>(`${BASE}/`, data)
    return response.data
}

export async function listAgents(params?: ListAgentsParams): Promise<Agent[]> {
    const response = await axiosInstance.get<Agent[]>(BASE + '/', { params })
    return response.data
}

export async function getAgent(agentId: string): Promise<Agent> {
    const response = await axiosInstance.get<Agent>(`${BASE}/${agentId}`)
    return response.data
}

export async function updateAgent(agentId: string, data: AgentUpdate): Promise<Agent> {
    const response = await axiosInstance.patch<Agent>(`${BASE}/${agentId}`, data)
    return response.data
}

export async function deleteAgent(agentId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/${agentId}`)
}
