import axiosInstance from './axiosInstance'

export interface AIProviderCreate {
    provider_name: string
    model_names: string[]
    url?: string | null
    secret_key?: string | null
}

export interface AIProviderUpdate {
    provider_name?: string | null
    model_names?: string[] | null
    url?: string | null
    secret_key?: string | null
}

export interface LLMModelInfo {
    id: string
    model_name: string
}

export interface AIProvider {
    id: string
    provider_name: string
    model_names: string[]
    models: LLMModelInfo[]
    url: string | null
    secret_key: string | null
    created_at: string
    updated_at: string
}

export interface ListProvidersParams {
    skip?: number
    limit?: number
}

const BASE = '/api/v1/ai-providers'

export async function createAIProvider(data: AIProviderCreate): Promise<AIProvider> {
    const response = await axiosInstance.post<AIProvider>(`${BASE}/`, data)
    return response.data
}

export async function listAIProviders(params?: ListProvidersParams): Promise<AIProvider[]> {
    const response = await axiosInstance.get<AIProvider[]>(BASE + '/', { params })
    return response.data
}

export async function getAIProvider(providerId: string): Promise<AIProvider> {
    const response = await axiosInstance.get<AIProvider>(`${BASE}/${providerId}`)
    return response.data
}

export async function updateAIProvider(
    providerId: string,
    data: AIProviderUpdate,
): Promise<AIProvider> {
    const response = await axiosInstance.patch<AIProvider>(`${BASE}/${providerId}`, data)
    return response.data
}

export async function deleteAIProvider(providerId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/${providerId}`)
}
