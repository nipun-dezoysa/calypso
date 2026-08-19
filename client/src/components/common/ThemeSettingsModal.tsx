import { useEffect, useState } from 'react'
import { IoPencilOutline, IoSaveOutline, IoTrashOutline } from 'react-icons/io5'
import Modal from './Modal'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Label } from '../ui/label'
import { useThemeStore, type CustomTheme } from '../../stores/ThemeStore'
import { BUILTIN_PRESETS } from '../../utils/theme'
import './ui.css'

interface ThemeSettingsModalProps {
    onClose: () => void
}

function Swatch({
    id,
    label,
    bg,
    accent,
    active,
}: {
    id: string
    label: string
    bg: string
    accent: string
    active: boolean
}) {
    return (
        <Label
            htmlFor={`theme-swatch-${id}`}
            className={`flex items-center gap-2 rounded-(--radius) border px-3 py-2 cursor-pointer transition-colors font-normal ${
                active ? 'border-(--c-accent)' : 'border-(--c-border) hover:border-(--c-text-subtle)'
            }`}
            style={{ background: bg }}
        >
            <RadioGroupItem
                id={`theme-swatch-${id}`}
                value={id}
                className="shrink-0 border-(--c-border)"
                style={{ color: accent, borderColor: accent }}
            />
            <span
                className="h-4 w-4 shrink-0 rounded-full border border-(--c-border)"
                style={{ background: accent }}
            />
            <span className="text-sm" style={{ color: active ? accent : undefined }}>{label}</span>
        </Label>
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
                <Button variant="secondary" onClick={handleClose} type="button">
                    Close
                </Button>
            }
        >
            <RadioGroup
                value={building ? '' : activeThemeId}
                onValueChange={(v) => { setBuilding(false); selectTheme(v) }}
            >
                <div className="form-field">
                    <label className="form-label">Presets</label>
                    <div className="flex flex-col gap-2">
                        {BUILTIN_PRESETS.map((preset) => (
                            <Swatch
                                key={preset.id}
                                id={preset.id}
                                label={preset.name}
                                bg={preset.tokens.bg}
                                accent={preset.tokens.accent}
                                active={!building && activeThemeId === preset.id}
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
                                            id={theme.id}
                                            label={theme.name}
                                            bg={theme.bg}
                                            accent={theme.accent}
                                            active={!building && activeThemeId === theme.id}
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
            </RadioGroup>

            <hr className="ui-divider" />

            {!building ? (
                <Button variant="secondary" onClick={startNewCustomTheme} type="button">
                    + New custom theme
                </Button>
            ) : (
                <>
                    <div className="form-field">
                        <label className="form-label" htmlFor="theme-name">
                            Theme name
                        </label>
                        <Input
                            id="theme-name"
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
                        <Button variant="secondary" onClick={cancelBuilding} type="button">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveCustomTheme}
                            disabled={!name.trim()}
                            type="button"
                        >
                            <IoSaveOutline style={{ fontSize: 15 }} /> Save theme
                        </Button>
                    </div>
                </>
            )}
        </Modal>
    )
}

export default ThemeSettingsModal
