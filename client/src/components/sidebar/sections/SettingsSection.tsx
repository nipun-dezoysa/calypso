import { useState } from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'
import KbSettingsModal from '../../common/KbSettingsModal'
import AccountSettingsModal from '../../common/AccountSettingsModal'
import ThemeSettingsModal from '../../common/ThemeSettingsModal'

type SettingsCategory = { label: string; onOpen: () => void }

function SettingsSection() {
    const [showKbSettings, setShowKbSettings] = useState(false)
    const [showAccountSettings, setShowAccountSettings] = useState(false)
    const [showThemeSettings, setShowThemeSettings] = useState(false)

    const categories: SettingsCategory[] = [
        { label: 'Account', onOpen: () => setShowAccountSettings(true) },
        { label: 'Theme & Appearance', onOpen: () => setShowThemeSettings(true) },
        { label: 'Knowledgebase', onOpen: () => setShowKbSettings(true) },
    ]

    return (
        <div>
            <CollapsibleSection title="Settings">
                {categories.map((category) => (
                    <div
                        key={category.label}
                        className="sidebar-item"
                        onClick={category.onOpen}
                    >
                        {category.label}
                    </div>
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
        </div>
    )
}

export default SettingsSection
