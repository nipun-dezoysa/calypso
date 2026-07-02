import { useState } from 'react'
import { IoArrowUp } from 'react-icons/io5'
import DropdownSelector, { type SelectOption } from '../../common/DropdownSelector'

const models: SelectOption[] = [
    { id: 'gemini-4', name: 'Gemini 4.0', description: 'Google' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI' },
    { id: 'claude-opus', name: 'Claude Opus', description: 'Anthropic' },
    { id: 'llama-4', name: 'Llama 4', description: 'Meta' },
]

const knowledgebases: SelectOption[] = [
    { id: 'kb-company', name: 'Company Docs', description: 'Internal documentation' },
    { id: 'kb-product', name: 'Product Wiki', description: 'Product knowledge base' },
    { id: 'kb-support', name: 'Support FAQs', description: 'Customer support articles' },
    { id: 'kb-api', name: 'API Reference', description: 'API documentation' },
]

const mcps: SelectOption[] = [
    { id: 'mcp-web', name: 'Web Search', description: 'Search the internet' },
    { id: 'mcp-code', name: 'Code Executor', description: 'Run code snippets' },
    { id: 'mcp-db', name: 'Database', description: 'Query databases' },
    { id: 'mcp-file', name: 'File System', description: 'Read & write files' },
]

function ChatInput() {
    const [selectedModel, setSelectedModel] = useState(models[0])
    const [selectedKB, setSelectedKB] = useState(knowledgebases[0])
    const [selectedMCPs, setSelectedMCPs] = useState<SelectOption[]>([])

    return (
        <div className='w-full absolute left-0 bottom-0 flex items-center justify-center pb-5 flex-col'>
            <div className=' bg-zinc-950 w-1/2 rounded-2xl  p-3'>
                <textarea className='w-full bg-transparent focus:outline-none text-zinc-300 resize-none placeholder:text-zinc-500' placeholder='Type your message here...'>
                </textarea>
                <div className='flex justify-between text-zinc-500 items-center'>
                    <div className='flex items-center gap-2'>
                        <DropdownSelector
                            options={models}
                            selected={selectedModel}
                            onSelect={setSelectedModel}
                            label='Select a model'
                        />
                        <span className='text-zinc-600'>·</span>
                        <DropdownSelector
                            options={knowledgebases}
                            selected={selectedKB}
                            onSelect={setSelectedKB}
                            label='Knowledgebase'
                        />
                        <span className='text-zinc-600'>·</span>
                        <DropdownSelector
                            options={mcps}
                            selected={selectedMCPs}
                            onSelect={setSelectedMCPs}
                            label='MCPs'
                            multiple
                        />
                    </div>
                    <button className='bg-amber-600 text-white p-2 rounded-sm cursor-pointer'><IoArrowUp /></button>
                </div>
            </div>
            <div className='text-zinc-500 text-xs pt-2'>AI models can make mistakes. Check important info.</div>
        </div>
    )
}

export default ChatInput