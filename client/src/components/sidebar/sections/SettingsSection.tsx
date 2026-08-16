import { useState } from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'
import KbSettingsModal from '../../common/KbSettingsModal'
import AccountSettingsModal from '../../common/AccountSettingsModal'

type SettingsCategory = { label: string; onOpen: () => void }

function SettingsSection() {
    const [showKbSettings, setShowKbSettings] = useState(false)
    const [showAccountSettings, setShowAccountSettings] = useState(false)

    const categories: SettingsCategory[] = [
        { label: 'Account', onOpen: () => setShowAccountSettings(true) },
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
        </div>
    )
}

export default SettingsSection
