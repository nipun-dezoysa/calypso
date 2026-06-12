import React from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'

function KnowledgeSection() {
    const knowledgeBases = [
        { name: "Project Wiki", documents: 12 },
        { name: "API Reference Docs", documents: 4 },
        { name: "Product Specs", documents: 8 },
        { name: "Customer FAQs", documents: 15 },
    ]

    return (
        <div>
            <CollapsibleSection
                title="Knowledgebases"
                action={{ label: '+ New', onClick: () => console.log('Create new knowledgebase') }}
            >
                {knowledgeBases.length > 0 ? (
                    knowledgeBases.map((kb, index) => (
                        <div
                            key={index}
                            className="sidebar-item flex justify-between items-center"
                            onClick={() => console.log(`Selected knowledgebase: ${kb.name}`)}
                        >
                            <span className="truncate">{kb.name}</span>
                            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full font-mono">
                                {kb.documents}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="sidebar-item sidebar-item--empty">
                        No knowledgebases
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Sync Status">
                <div className="sidebar-item flex justify-between items-center text-zinc-500">
                    <span className="truncate text-xs">All up to date</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
            </CollapsibleSection>
        </div>
    )
}

export default KnowledgeSection
