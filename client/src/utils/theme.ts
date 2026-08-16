// Small hand-rolled color math — no new dependency for 3-seed-color theme
// derivation. sRGB channel mixing is not perceptually uniform, but that's an
// acceptable v1 tradeoff for a user-picked accent/background/surface trio.

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
    const num = parseInt(full, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
    return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')
}

function mix(hexA: string, hexB: string, t: number): string {
    const [r1, g1, b1] = hexToRgb(hexA)
    const [r2, g2, b2] = hexToRgb(hexB)
    return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// WCAG relative luminance / contrast ratio.
function relativeLuminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex)
    const lin = (c: number) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(hexA: string, hexB: string): number {
    const l1 = relativeLuminance(hexA)
    const l2 = relativeLuminance(hexB)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
}

function isDark(hex: string): boolean {
    return relativeLuminance(hex) < 0.5
}

const NEAR_WHITE = '#f4f4f5'
const NEAR_BLACK = '#18181b'

/** Whichever of near-white/near-black reads better on top of `bgHex`. */
function pickContrastText(bgHex: string): string {
    const withWhite = contrastRatio(bgHex, '#ffffff')
    const withBlack = contrastRatio(bgHex, '#000000')
    return withBlack >= withWhite ? NEAR_BLACK : NEAR_WHITE
}

// ── Theme tokens ────────────────────────────────────────────────────────
// Mirrors the theme-able custom properties in ui.css's `:root` block.
// --c-danger*/--c-success* are deliberately excluded: they're fixed status
// colors that never change with the theme.

export interface ThemeTokens {
    bg: string
    surface: string
    hover: string
    activeBg: string
    border: string
    borderFocus: string
    textStrong: string
    text: string
    textBody: string
    textDim: string
    textMuted: string
    textSubtle: string
    accent: string
    accentHi: string
    accentLo: string
    accentContrast: string
}

export interface ThemeSeed {
    bg: string
    surface: string
    accent: string
}

/** The CSS custom property each token maps to. Shared with the anti-flash
 * boot script in index.html, which keeps its own copy of this list since it
 * runs as unbundled JS before any module script loads. */
export const CSS_VAR_MAP: [keyof ThemeTokens, string][] = [
    ['bg', '--c-bg'],
    ['surface', '--c-surface'],
    ['hover', '--c-hover'],
    ['activeBg', '--c-active-bg'],
    ['border', '--c-border'],
    ['borderFocus', '--c-border-focus'],
    ['textStrong', '--c-text-strong'],
    ['text', '--c-text'],
    ['textBody', '--c-text-body'],
    ['textDim', '--c-text-dim'],
    ['textMuted', '--c-text-muted'],
    ['textSubtle', '--c-text-subtle'],
    ['accent', '--c-accent'],
    ['accentHi', '--c-accent-hi'],
    ['accentLo', '--c-accent-lo'],
    ['accentContrast', '--c-accent-contrast'],
]

/** Derive a full token map from 3 seed colors. Used for every preset except
 * "Default" (which stays hand-authored — Tailwind's zinc scale isn't a
 * uniform ramp, so a generic mix can't reproduce it exactly) and for every
 * custom theme. */
export function deriveTheme({ bg, surface, accent }: ThemeSeed): ThemeTokens {
    const dark = isDark(bg)
    const textStrong = dark ? NEAR_WHITE : NEAR_BLACK

    // Each tier mixes progressively more toward the background (less contrast).
    const text = mix(textStrong, bg, 0.12)
    const textBody = mix(textStrong, bg, 0.22)
    const textDim = mix(textStrong, bg, 0.42)
    const textMuted = mix(textStrong, bg, 0.58)
    const textSubtle = mix(textStrong, bg, 0.72)

    const hover = mix(surface, textStrong, 0.08)
    const activeBg = mix(surface, textStrong, 0.14)
    const border = mix(surface, textStrong, 0.22)

    // Pressed/hover on a solid accent button always reads as "darker".
    const accentLo = mix(accent, '#000000', 0.15)
    // Hover/emphasis text needs to gain contrast against the surface either
    // way — lighten on a dark theme, darken on a light one.
    const accentHi = dark ? mix(accent, '#ffffff', 0.25) : mix(accent, '#000000', 0.2)
    const accentContrast = pickContrastText(accent)

    return {
        bg,
        surface,
        hover,
        activeBg,
        border,
        borderFocus: accent,
        textStrong,
        text,
        textBody,
        textDim,
        textMuted,
        textSubtle,
        accent,
        accentHi,
        accentLo,
        accentContrast,
    }
}

// ── Built-in presets ───────────────────────────────────────────────────

export const DEFAULT_THEME: ThemeTokens = {
    bg: '#09090b',
    surface: '#18181b',
    hover: '#27272a',
    activeBg: '#2d2d30',
    border: '#3f3f46',
    borderFocus: '#d97706',
    textStrong: '#f4f4f5',
    text: '#e4e4e7',
    textBody: '#d4d4d8',
    textDim: '#a1a1aa',
    textMuted: '#71717a',
    textSubtle: '#52525b',
    accent: '#d97706',
    accentHi: '#fbbf24',
    accentLo: '#b45309',
    accentContrast: '#18181b',
}

export const OCEAN_THEME: ThemeTokens = deriveTheme({
    bg: '#09090b',
    surface: '#18181b',
    accent: '#3b82f6',
})

export const LIGHT_THEME: ThemeTokens = deriveTheme({
    bg: '#fafafa',
    surface: '#ffffff',
    accent: '#d97706',
})

export interface ThemePreset {
    id: string
    name: string
    tokens: ThemeTokens
}

export const BUILTIN_PRESETS: ThemePreset[] = [
    { id: 'default', name: 'Default', tokens: DEFAULT_THEME },
    { id: 'ocean', name: 'Ocean', tokens: OCEAN_THEME },
    { id: 'light', name: 'Light', tokens: LIGHT_THEME },
]

// ── Applying a theme ───────────────────────────────────────────────────

/** Kept in sync on every apply so the boot-time inline script in index.html
 * can repaint the last-active theme before React (or even this module) has
 * loaded, without duplicating `deriveTheme`. */
export const ACTIVE_THEME_SNAPSHOT_KEY = 'calypso-active-theme-tokens'

export function applyThemeTokens(tokens: ThemeTokens): void {
    const root = document.documentElement.style
    for (const [key, cssVar] of CSS_VAR_MAP) {
        root.setProperty(cssVar, tokens[key])
    }
    try {
        localStorage.setItem(ACTIVE_THEME_SNAPSHOT_KEY, JSON.stringify(tokens))
    } catch {
        // Best-effort — worst case the next boot just paints Default first.
    }
}
