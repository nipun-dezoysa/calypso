import { useState, type ReactNode } from 'react'
import { IoChevronForward } from 'react-icons/io5'
import './CollapsibleSection.css'

interface CollapsibleSectionProps {
    title: string
    action?: {
        label: string
        onClick: () => void
    }
    defaultOpen?: boolean
    children: ReactNode
}

function CollapsibleSection({
    title,
    action,
    defaultOpen = true,
    children,
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div className="collapsible-section">
            <div
                className="collapsible-section__header"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <div className="collapsible-section__title-group">
                    <IoChevronForward
                        className={`collapsible-section__chevron ${isOpen ? 'collapsible-section__chevron--open' : ''}`}
                    />
                    <span className="collapsible-section__title">{title}</span>
                </div>

                {action && (
                    <button
                        className="collapsible-section__action"
                        onClick={(e) => {
                            e.stopPropagation() // prevent header toggle
                            action.onClick()
                        }}
                    >
                        {action.label}
                    </button>
                )}
            </div>

            <div
                className={`collapsible-section__body ${isOpen ? 'collapsible-section__body--open' : ''}`}
            >
                <div className="collapsible-section__content">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default CollapsibleSection
