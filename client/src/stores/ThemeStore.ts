import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
    applyThemeTokens,
    deriveTheme,
    BUILTIN_PRESETS,
    type ThemeSeed,
    type ThemeTokens,
} from '../utils/theme'

export interface CustomTheme {
    id: string
    name: string
    bg: string
    surface: string
    accent: string
}

interface ThemeState {
    activeThemeId: string
    customThemes: CustomTheme[]

    /** Resolve and apply whichever theme `activeThemeId` currently points at
     * — call once on boot after the store rehydrates from localStorage. */
    applyActiveTheme: () => void
    selectTheme: (id: string) => void
    /** Applies the seed live without selecting/persisting it — used for the
     * custom-theme builder's color pickers so the whole app previews the
     * pick before the user commits to it with a name. */
    previewSeed: (seed: ThemeSeed) => void
    saveCustomTheme: (name: string, seed: ThemeSeed, existingId?: string) => string
    deleteCustomTheme: (id: string) => void
    /** Tokens for whichever theme `id` refers to, or null if it no longer exists. */
    resolveTokens: (id: string) => ThemeTokens | null
}

function resolve(id: string, customThemes: CustomTheme[]): ThemeTokens | null {
    const preset = BUILTIN_PRESETS.find((p) => p.id === id)
    if (preset) return preset.tokens
    const custom = customThemes.find((t) => t.id === id)
    if (custom) return deriveTheme(custom)
    return null
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            activeThemeId: 'default',
            customThemes: [],

            applyActiveTheme: () => {
                const { activeThemeId, customThemes } = get()
                const tokens = resolve(activeThemeId, customThemes) ?? BUILTIN_PRESETS[0].tokens
                applyThemeTokens(tokens)
            },

            selectTheme: (id) => {
                const tokens = resolve(id, get().customThemes)
                if (!tokens) return
                set({ activeThemeId: id })
                applyThemeTokens(tokens)
            },

            previewSeed: (seed) => {
                applyThemeTokens(deriveTheme(seed))
            },

            saveCustomTheme: (name, seed, existingId) => {
                const id = existingId ?? `custom-${Date.now()}`
                const theme: CustomTheme = { id, name, ...seed }
                set((s) => ({
                    customThemes: existingId
                        ? s.customThemes.map((t) => (t.id === existingId ? theme : t))
                        : [...s.customThemes, theme],
                    activeThemeId: id,
                }))
                applyThemeTokens(deriveTheme(seed))
                return id
            },

            deleteCustomTheme: (id) => {
                set((s) => ({
                    customThemes: s.customThemes.filter((t) => t.id !== id),
                }))
                // Deleting the active theme falls back to Default.
                if (get().activeThemeId === id) {
                    set({ activeThemeId: 'default' })
                    applyThemeTokens(BUILTIN_PRESETS[0].tokens)
                }
            },

            resolveTokens: (id) => resolve(id, get().customThemes),
        }),
        {
            name: 'calypso-theme',
            partialize: (s) => ({ activeThemeId: s.activeThemeId, customThemes: s.customThemes }),
        },
    ),
)
