import { useState } from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'
import KbSettingsModal from '../../common/KbSettingsModal'
import AccountSettingsModal from '../../common/AccountSettingsModal'
import ThemeSettingsModal from '../../common/ThemeSettingsModal'
import TourSettingsModal from '../../common/TourSettingsModal'
import { Button } from '../../ui/button'

type SettingsCategory = { label: string; onOpen: () => void }

function SettingsSection() {
    const [showKbSettings, setShowKbSettings] = useState(false)
    const [showAccountSettings, setShowAccountSettings] = useState(false)
    const [showThemeSettings, setShowThemeSettings] = useState(false)
    const [showTourSettings, setShowTourSettings] = useState(false)

    const categories: SettingsCategory[] = [
        { label: 'Account', onOpen: () => setShowAccountSettings(true) },
        { label: 'Theme & Appearance', onOpen: () => setShowThemeSettings(true) },
        { label: 'Knowledgebase', onOpen: () => setShowKbSettings(true) },
        { label: 'Product Tour', onOpen: () => setShowTourSettings(true) },
    ]

    return (
        <div>
            <CollapsibleSection title="Settings">
                {categories.map((category) => (
                    <Button
                        key={category.label}
                        type="button"
                        variant="ghost"
                        onClick={category.onOpen}
                        className="w-full justify-start h-auto rounded-none py-1 pl-6 pr-2.5 text-[13px] font-normal text-(--c-text-dim) hover:bg-(--c-hover) hover:text-(--c-text)"
                    >
                        {category.label}
                    </Button>
                ))}
            </CollapsibleSection>

            {showKbSettings && (
                <KbSettingsModal onClose={() => setShowKbSettings(false)} />
            )}
            {showAccountSettings && (
                <AccountSettingsModal onClose={() => setShowAccountSettings(false)} />
            )}
            {showThemeSettings && (
                <ThemeSettingsModal onClose={() => setShowThemeSettings(false)} />
            )}
            {showTourSettings && (
                <TourSettingsModal onClose={() => setShowTourSettings(false)} />
            )}
        </div>
    )
}

export default SettingsSection
