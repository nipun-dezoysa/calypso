import CollapsibleSection from '../../common/CollapsibleSection'

function AgentSection() {
    const agents = [
        "School assignments",
        "research agent",
        "writing assistant",
        "coder agent",
        "data analyst agent",
        "marketing agent",
        "sales agent",
        "support agent",
    ]

    return (
        <div>
            {/* Agents section */}
            <CollapsibleSection
                title="Agents"
                action={{ label: '+ New', onClick: () => console.log('Add agent') }}
            >
                {agents.map((agent, index) => (
                    <div
                        key={index}
                        className="sidebar-item"
                    >
                        {agent}
                    </div>
                ))}
            </CollapsibleSection>

            {/* Recent chats section */}
            <CollapsibleSection title="Recent Chats">
                <div className="sidebar-item sidebar-item--empty">
                    No recent chats
                </div>
            </CollapsibleSection>
        </div>
    )
}

export default AgentSection