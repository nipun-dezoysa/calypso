import { useState } from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'
import KbSettingsModal from '../../common/KbSettingsModal'

type SettingsCategory = { label: string; onOpen?: () => void }

function SettingsSection() {
    const [showKbSettings, setShowKbSettings] = useState(false)

    const categories: SettingsCategory[] = [
        { label: 'General Settings' },
        { label: 'AI Providers Configuration' },
        { label: 'Knowledgebase', onOpen: () => setShowKbSettings(true) },
        { label: 'Keyboard Shortcuts' },
        { label: 'Theme & Appearance' },
        { label: 'API Keys Manager' },
        { label: 'System Diagnostics' },
    ]

    return (
        <div>
            <CollapsibleSection title="Settings">
                {categories.map((category) => (
                    <div
                        key={category.label}
                        className="sidebar-item"
                        onClick={() =>
                            category.onOpen
                                ? category.onOpen()
                                : console.log(`Selected settings category: ${category.label}`)
                        }
                    >
                        {category.label}
                    </div>
                ))}
            </CollapsibleSection>

            {showKbSettings && (
                <KbSettingsModal onClose={() => setShowKbSettings(false)} />
            )}
        </div>
    )
}

export default SettingsSection
