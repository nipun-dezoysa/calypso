import axios, {
    type AxiosInstance,
    type AxiosError,
    type InternalAxiosRequestConfig,
    type AxiosResponse,
} from 'axios'

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

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
        const token = localStorage.getItem('calypso_access_token')
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
                new Error('No response from server — check your network connection.'),
            )
        }

        return Promise.reject(error)
    },
)

export default axiosInstance
