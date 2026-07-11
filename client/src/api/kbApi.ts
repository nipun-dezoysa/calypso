import axiosInstance from './axiosInstance'

// ── Collections ─────────────────────────────────────────────────────────────

export interface Collection {
    id: string
    name: string
    description: string | null
    document_count: number
    created_at: string
    updated_at: string
}

export interface CollectionCreate {
    name: string
    description?: string | null
}

export interface CollectionUpdate {
    name?: string | null
    description?: string | null
}

// ── Documents ───────────────────────────────────────────────────────────────

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface KbDocument {
    id: string
    collection_id: string
    filename: string
    content_type: string | null
    size_bytes: number | null
    status: DocumentStatus
    error_message: string | null
    chunk_count: number
    created_at: string
    updated_at: string
}

// ── Settings ────────────────────────────────────────────────────────────────

export type VectorDbProvider = 'chroma' | 'qdrant'
export type EmbeddingProvider = 'fastembed' | 'nomic'

export interface KbSettings {
    vector_db_provider: VectorDbProvider
    qdrant_url: string | null
    qdrant_api_key_set: boolean
    embedding_provider: EmbeddingProvider
    embedding_model: string | null
    nomic_api_key_set: boolean
    updated_at: string
}

export interface KbSettingsUpdate {
    vector_db_provider?: VectorDbProvider
    qdrant_url?: string | null
    qdrant_api_key?: string | null
    embedding_provider?: EmbeddingProvider
    embedding_model?: string | null
    nomic_api_key?: string | null
}

export interface ListParams {
    skip?: number
    limit?: number
}

// The backend mounts these routes without trailing slashes, so keep the paths
// exact to avoid 307 redirects that drop the request body.
const BASE = '/api/v1/kb'

// ── Collection calls ──

export async function listCollections(params?: ListParams): Promise<Collection[]> {
    const response = await axiosInstance.get<Collection[]>(`${BASE}/collections`, { params })
    return response.data
}

export async function createCollection(data: CollectionCreate): Promise<Collection> {
    const response = await axiosInstance.post<Collection>(`${BASE}/collections`, data)
    return response.data
}

export async function getCollection(collectionId: string): Promise<Collection> {
    const response = await axiosInstance.get<Collection>(`${BASE}/collections/${collectionId}`)
    return response.data
}

export async function updateCollection(
    collectionId: string,
    data: CollectionUpdate,
): Promise<Collection> {
    const response = await axiosInstance.patch<Collection>(
        `${BASE}/collections/${collectionId}`,
        data,
    )
    return response.data
}

export async function deleteCollection(collectionId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/collections/${collectionId}`)
}

// ── Document calls ──

export async function listDocuments(
    collectionId: string,
    params?: ListParams,
): Promise<KbDocument[]> {
    const response = await axiosInstance.get<KbDocument[]>(
        `${BASE}/collections/${collectionId}/documents`,
        { params },
    )
    return response.data
}

export async function uploadDocument(
    collectionId: string,
    file: File,
): Promise<KbDocument> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axiosInstance.post<KbDocument>(
        `${BASE}/collections/${collectionId}/documents`,
        formData,
        // Let the browser set multipart/form-data with the correct boundary.
        { headers: { 'Content-Type': undefined }, timeout: 60_000 },
    )
    return response.data
}

export async function getDocument(documentId: string): Promise<KbDocument> {
    const response = await axiosInstance.get<KbDocument>(`${BASE}/documents/${documentId}`)
    return response.data
}

export async function deleteDocument(documentId: string): Promise<void> {
    await axiosInstance.delete(`${BASE}/documents/${documentId}`)
}

// ── Settings calls ──

export async function getKbSettings(): Promise<KbSettings> {
    const response = await axiosInstance.get<KbSettings>(`${BASE}/settings`)
    return response.data
}

export async function updateKbSettings(data: KbSettingsUpdate): Promise<KbSettings> {
    const response = await axiosInstance.put<KbSettings>(`${BASE}/settings`, data)
    return response.data
}
