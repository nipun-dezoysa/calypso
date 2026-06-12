import React from 'react'
import CollapsibleSection from '../../common/CollapsibleSection'

const providers = [
    {
        name: "Gemini",
        models: ["gemini-2.5-flash", "gemini-2.5-pro"]
    },
    {
        name: "OpenAI",
        models: ["gpt-4", "gpt-5", "gpt-4.1"]
    },
    {
        name: "Ollama",
        models: ["llama3", "llama3.1"]
    }
]

function ModelSection() {
    return (
        <div>
            <CollapsibleSection 
                title="AI Providers"
                action={{ label: 'Manage', onClick: () => console.log('Manage providers') }}
            >
                <div className="py-1">
                    {providers.map((provider) => (
                        <div key={provider.name} className="mb-3">
                            <div className="text-[10px] font-semibold text-zinc-600 uppercase px-6 mb-1 tracking-wider">
                                {provider.name}
                            </div>
                            {provider.models.map((model) => (
                                <div
                                    key={model}
                                    className="sidebar-item flex items-center justify-between"
                                >
                                    <span>{model}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active"></span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Active Models">
                <div className="sidebar-item">
                    gemini-2.5-flash (Default)
                </div>
                <div className="sidebar-item">
                    gpt-4
                </div>
            </CollapsibleSection>
        </div>
    )
}

export default ModelSection