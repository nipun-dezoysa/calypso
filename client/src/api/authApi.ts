import axiosInstance, { TOKEN_STORAGE_KEY } from './axiosInstance'

export { TOKEN_STORAGE_KEY }

export interface AuthUser {
    id: string
    username: string
    must_change_credentials: boolean
    created_at: string
    updated_at: string
}

export interface TokenResponse {
    access_token: string
    token_type: string
    expires_in: number
    user: AuthUser
}

export interface LoginRequest {
    username: string
    password: string
}

export interface CredentialsUpdate {
    current_password: string
    username?: string
    new_password?: string
}

const BASE = '/api/v1/auth'

export function getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function storeToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
    const response = await axiosInstance.post<TokenResponse>(`${BASE}/login`, data)
    return response.data
}

export async function getMe(): Promise<AuthUser> {
    const response = await axiosInstance.get<AuthUser>(`${BASE}/me`)
    return response.data
}

export async function updateCredentials(data: CredentialsUpdate): Promise<TokenResponse> {
    const response = await axiosInstance.put<TokenResponse>(`${BASE}/credentials`, data)
    return response.data
}
