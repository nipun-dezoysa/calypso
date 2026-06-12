import React from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'

function SettingsSection() {
    const categories = [
        "General Settings",
        "AI Providers Configuration",
        "Keyboard Shortcuts",
        "Theme & Appearance",
        "API Keys Manager",
        "System Diagnostics",
    ]

    return (
        <div>
            <CollapsibleSection title="Settings">
                {categories.map((category, index) => (
                    <div
                        key={index}
                        className="sidebar-item"
                        onClick={() => console.log(`Selected settings category: ${category}`)}
                    >
                        {category}
                    </div>
                ))}
            </CollapsibleSection>
        </div>
    )
}

export default SettingsSection
