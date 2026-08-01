import { create } from 'zustand'
import {
    clearStoredToken,
    getMe,
    getStoredToken,
    login as loginRequest,
    storeToken,
    updateCredentials as updateCredentialsRequest,
    type AuthUser,
    type CredentialsUpdate,
} from '../api/authApi'
import { UNAUTHORIZED_EVENT } from '../api/axiosInstance'

/** 'loading' covers the initial token check, before we know which screen to show. */
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

interface AuthState {
    status: AuthStatus
    user: AuthUser | null
    /** Restore a session from the stored token, or fall back to signed out. */
    bootstrap: () => Promise<void>
    login: (username: string, password: string) => Promise<void>
    updateCredentials: (data: CredentialsUpdate) => Promise<void>
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    status: 'loading',
    user: null,

    bootstrap: async () => {
        if (!getStoredToken()) {
            set({ status: 'signed-out', user: null })
            return
        }
        try {
            const user = await getMe()
            set({ status: 'signed-in', user })
        } catch {
            // The interceptor has already cleared the token on a 401.
            clearStoredToken()
            set({ status: 'signed-out', user: null })
        }
    },

    login: async (username, password) => {
        const result = await loginRequest({ username, password })
        storeToken(result.access_token)
        set({ status: 'signed-in', user: result.user })
    },

    updateCredentials: async (data) => {
        // Changing the password invalidates the old token, so swap in the new
        // one the server hands back before any other request goes out.
        const result = await updateCredentialsRequest(data)
        storeToken(result.access_token)
        set({ status: 'signed-in', user: result.user })
    },

    logout: () => {
        clearStoredToken()
        set({ status: 'signed-out', user: null })
    },
}))

window.addEventListener(UNAUTHORIZED_EVENT, () => {
    if (useAuthStore.getState().status !== 'signed-out') {
        useAuthStore.setState({ status: 'signed-out', user: null })
    }
})
