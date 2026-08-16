import { useEffect, useState } from 'react'
import { IoCheckmark, IoPencilOutline, IoSaveOutline, IoTrashOutline } from 'react-icons/io5'
import Modal from './Modal'
import { useThemeStore, type CustomTheme } from '../../stores/ThemeStore'
import { BUILTIN_PRESETS } from '../../utils/theme'
import './ui.css'

interface ThemeSettingsModalProps {
    onClose: () => void
}

function Swatch({
    label,
    bg,
    accent,
    active,
    onClick,
}: {
    label: string
    bg: string
    accent: string
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 rounded-(--radius) border px-3 py-2 text-left transition-colors ${
                active ? 'border-(--c-accent)' : 'border-(--c-border) hover:border-(--c-text-subtle)'
            }`}
            style={{ background: bg }}
        >
            <span
                className="h-4 w-4 shrink-0 rounded-full border border-(--c-border)"
                style={{ background: accent }}
            />
            <span className="text-sm" style={{ color: active ? accent : undefined }}>{label}</span>
            {active && <IoCheckmark className="ml-auto shrink-0" style={{ color: accent }} />}
        </button>
    )
}

function ThemeSettingsModal({ onClose }: ThemeSettingsModalProps) {
    const activeThemeId = useThemeStore((s) => s.activeThemeId)
    const customThemes = useThemeStore((s) => s.customThemes)
    const selectTheme = useThemeStore((s) => s.selectTheme)
    const previewSeed = useThemeStore((s) => s.previewSeed)
    const saveCustomTheme = useThemeStore((s) => s.saveCustomTheme)
    const deleteCustomTheme = useThemeStore((s) => s.deleteCustomTheme)
    const applyActiveTheme = useThemeStore((s) => s.applyActiveTheme)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [bg, setBg] = useState('#09090b')
    const [surface, setSurface] = useState('#18181b')
    const [accent, setAccent] = useState('#d97706')
    const [building, setBuilding] = useState(false)

    useEffect(() => {
        if (!building) return
        previewSeed({ bg, surface, accent })
    }, [building, bg, surface, accent, previewSeed])

    function startNewCustomTheme() {
        setEditingId(null)
        setName('')
        setBg('#09090b')
        setSurface('#18181b')
        setAccent('#d97706')
        setBuilding(true)
    }

    function startEditCustomTheme(theme: CustomTheme) {
        setEditingId(theme.id)
        setName(theme.name)
        setBg(theme.bg)
        setSurface(theme.surface)
        setAccent(theme.accent)
        setBuilding(true)
    }

    function cancelBuilding() {
        setBuilding(false)
        applyActiveTheme()
    }

    function handleSaveCustomTheme() {
        const trimmed = name.trim()
        if (!trimmed) return
        saveCustomTheme(trimmed, { bg, surface, accent }, editingId ?? undefined)
        setBuilding(false)
    }

    function handleClose() {
        if (building) applyActiveTheme()
        onClose()
    }

    return (
        <Modal
            title="Theme & Appearance"
            subtitle="Pick a theme, or build your own"
            onClose={handleClose}
            onEscape={handleClose}
            footer={
                <button className="btn btn--cancel" onClick={handleClose} type="button">
                    Close
                </button>
            }
        >
            <div className="form-field">
                <label className="form-label">Presets</label>
                <div className="flex flex-col gap-2">
                    {BUILTIN_PRESETS.map((preset) => (
                        <Swatch
                            key={preset.id}
                            label={preset.name}
                            bg={preset.tokens.bg}
                            accent={preset.tokens.accent}
                            active={!building && activeThemeId === preset.id}
                            onClick={() => { setBuilding(false); selectTheme(preset.id) }}
                        />
                    ))}
                </div>
            </div>

            {customThemes.length > 0 && (
                <div className="form-field">
                    <label className="form-label">Your themes</label>
                    <div className="flex flex-col gap-2">
                        {customThemes.map((theme) => (
                            <div key={theme.id} className="flex items-center gap-1 group">
                                <div className="flex-1 min-w-0">
                                    <Swatch
                                        label={theme.name}
                                        bg={theme.bg}
                                        accent={theme.accent}
                                        active={!building && activeThemeId === theme.id}
                                        onClick={() => { setBuilding(false); selectTheme(theme.id) }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => startEditCustomTheme(theme)}
                                    title="Edit theme"
                                    aria-label={`Edit theme ${theme.name}`}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-accent-hi) p-1 shrink-0"
                                >
                                    <IoPencilOutline size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => deleteCustomTheme(theme.id)}
                                    title="Delete theme"
                                    aria-label={`Delete theme ${theme.name}`}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-(--c-text-subtle) hover:text-(--c-danger-text) p-1 shrink-0"
                                >
                                    <IoTrashOutline size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <hr className="ui-divider" />

            {!building ? (
                <button className="btn btn--cancel" onClick={startNewCustomTheme} type="button">
                    + New custom theme
                </button>
            ) : (
                <>
                    <div className="form-field">
                        <label className="form-label" htmlFor="theme-name">
                            Theme name
                        </label>
                        <input
                            id="theme-name"
                            className="form-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My theme"
                            spellCheck={false}
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="form-field">
                            <label className="form-label" htmlFor="theme-bg">Background</label>
                            <input
                                id="theme-bg"
                                type="color"
                                value={bg}
                                onChange={(e) => setBg(e.target.value)}
                                className="h-9 w-16 cursor-pointer rounded-(--radius-sm) border border-(--c-border) bg-transparent"
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label" htmlFor="theme-surface">Surface</label>
                            <input
                                id="theme-surface"
                                type="color"
                                value={surface}
                                onChange={(e) => setSurface(e.target.value)}
                                className="h-9 w-16 cursor-pointer rounded-(--radius-sm) border border-(--c-border) bg-transparent"
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label" htmlFor="theme-accent">Accent</label>
                            <input
                                id="theme-accent"
                                type="color"
                                value={accent}
                                onChange={(e) => setAccent(e.target.value)}
                                className="h-9 w-16 cursor-pointer rounded-(--radius-sm) border border-(--c-border) bg-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button className="btn btn--cancel" onClick={cancelBuilding} type="button">
                            Cancel
                        </button>
                        <button
                            className="btn btn--primary"
                            onClick={handleSaveCustomTheme}
                            disabled={!name.trim()}
                            type="button"
                        >
                            <IoSaveOutline style={{ fontSize: 15 }} /> Save theme
                        </button>
                    </div>
                </>
            )}
        </Modal>
    )
}

export default ThemeSettingsModal
