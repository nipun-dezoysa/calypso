import axios, {
    type AxiosInstance,
    type AxiosError,
    type InternalAxiosRequestConfig,
    type AxiosResponse,
} from 'axios'

export const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

export const TOKEN_STORAGE_KEY = 'calypso_access_token'

/** Fired when the server rejects our token, so the auth store can sign out.
 * An event rather than a direct import, which would be circular. */
export const UNAUTHORIZED_EVENT = 'calypso:unauthorized'

const axiosInstance: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 15_000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
    withCredentials: false,
})

axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY)
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error: AxiosError) => Promise.reject(error),
)

axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
        if (error.response) {
            const { status, data } = error.response

            // A 401 anywhere but the login form itself means the stored token is
            // gone or stale, so drop it and let the app fall back to the login screen.
            const isLoginAttempt = error.config?.url?.includes('/auth/login') ?? false
            if (status === 401 && !isLoginAttempt) {
                localStorage.removeItem(TOKEN_STORAGE_KEY)
                window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
            }

            let message = `Request failed with status ${status}`
            if (data?.detail) {
                if (Array.isArray(data.detail)) {
                    message = data.detail.map((d) => d.msg).join('; ')
                } else if (typeof data.detail === 'string') {
                    message = data.detail
                }
            }

            return Promise.reject(new Error(message))
        }

        if (error.request) {
            return Promise.reject(
                new Error('No response from server. Check your network connection.'),
            )
        }

        return Promise.reject(error)
    },
)

export default axiosInstance
