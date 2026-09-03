import axiosInstance from './axiosInstance'

// ── Types ───────────────────────────────────────────────────────────────────

/** The saved settings. The secret key never comes back. */
export interface LangfuseSettings {
    enabled: boolean
    host: string
    public_key: string | null
    secret_key_set: boolean
    environment: string | null
    sample_rate: number
    /** Tracing is on *and* fully configured, so runs are being sent. */
    active: boolean
    updated_at: string
}

/** Only the fields sent are changed. */
export interface LangfuseSettingsUpdate {
    enabled?: boolean | null
    host?: string | null
    public_key?: string | null
    secret_key?: string | null
    environment?: string | null
    sample_rate?: number | null
}

/** Anything omitted is taken from what is saved, so the secret key does not
 * have to be re-typed just to test a host. */
export interface LangfuseCredentialsTest {
    host?: string | null
    public_key?: string | null
    secret_key?: string | null
}

export interface LangfuseTestResult {
    ok: boolean
    detail: string
}

// The backend mounts these routes without trailing slashes, so keep the paths
// exact to avoid 307 redirects that drop the request body.
const BASE = '/api/v1/langfuse'

// ── Calls ───────────────────────────────────────────────────────────────────

export async function getLangfuseSettings(): Promise<LangfuseSettings> {
    const response = await axiosInstance.get<LangfuseSettings>(`${BASE}/settings`)
    return response.data
}

export async function updateLangfuseSettings(
    data: LangfuseSettingsUpdate,
): Promise<LangfuseSettings> {
    const response = await axiosInstance.put<LangfuseSettings>(`${BASE}/settings`, data)
    return response.data
}

export async function testLangfuseConnection(
    data: LangfuseCredentialsTest,
): Promise<LangfuseTestResult> {
    // Reaching a remote Langfuse can outlast the instance-wide 15s timeout.
    const response = await axiosInstance.post<LangfuseTestResult>(
        `${BASE}/settings/test`,
        data,
        { timeout: 30_000 },
    )
    return response.data
}
