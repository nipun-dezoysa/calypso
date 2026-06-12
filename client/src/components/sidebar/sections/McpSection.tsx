import React from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'

function McpSection() {
    const servers = [
        { name: "filesystem-server", tools: 8, status: "connected" },
        { name: "github-integration", tools: 14, status: "connected" },
        { name: "postgres-query", tools: 5, status: "disconnected" },
    ]

    return (
        <div>
            <CollapsibleSection
                title="MCP Servers"
                action={{ label: '+ Add', onClick: () => console.log('Add MCP server') }}
            >
                {servers.map((server, index) => (
                    <div
                        key={index}
                        className="sidebar-item flex justify-between items-center"
                        onClick={() => console.log(`Selected MCP: ${server.name}`)}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="truncate">{server.name}</span>
                            <span className="text-[10px] text-zinc-500">{server.tools} tools available</span>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${
                            server.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'
                        }`} title={server.status}></span>
                    </div>
                ))}
            </CollapsibleSection>
        </div>
    )
}

export default McpSection
