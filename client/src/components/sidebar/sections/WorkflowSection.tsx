import CollapsibleSection from '../../common/CollapsibleSection'

function WorkflowSection() {
    const workflows = [
        { name: "Code Review Assistant", status: "active" },
        { name: "Support Ticket Router", status: "active" },
        { name: "Data Sync pipeline", status: "paused" },
    ]

    return (
        <div>
            <CollapsibleSection
                title="Workflows"
                action={{ label: '+ New', onClick: () => console.log('Create new workflow') }}
            >
                {workflows.map((flow, index) => (
                    <div
                        key={index}
                        className="sidebar-item flex justify-between items-center"
                        onClick={() => console.log(`Selected workflow: ${flow.name}`)}
                    >
                        <span className="truncate">{flow.name}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
                            flow.status === 'active' ? 'text-emerald-400 bg-emerald-950/50' : 'text-zinc-500 bg-zinc-800'
                        }`}>
                            {flow.status}
                        </span>
                    </div>
                ))}
            </CollapsibleSection>

            <CollapsibleSection title="Execution Logs">
                <div className="sidebar-item text-xs text-zinc-500 flex justify-between">
                    <span>Code Review Run</span>
                    <span className="text-emerald-500">Success</span>
                </div>
                <div className="sidebar-item text-xs text-zinc-500 flex justify-between">
                    <span>Ticket Router Run</span>
                    <span className="text-emerald-500">Success</span>
                </div>
            </CollapsibleSection>
        </div>
    )
}

export default WorkflowSection
