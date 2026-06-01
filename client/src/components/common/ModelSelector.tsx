import React, { useState, useRef, useEffect } from 'react'
import { IoChevronDown, IoChevronUp, IoCheckmark } from 'react-icons/io5'

export interface ModelOption {
    id: string
    name: string
    provider: string
}

interface ModelSelectorProps {
    models: ModelOption[]
    selectedModel: ModelOption
    onSelect: (model: ModelOption) => void
    label?: string
}

function ModelSelector({ models, selectedModel, onSelect, label = 'Select a model' }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className='relative' ref={dropdownRef}>
            <button
                className='flex items-center gap-1 hover:text-zinc-300 transition-colors text-sm cursor-pointer'
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{selectedModel.name}</span>
                {isOpen ? <IoChevronUp /> : <IoChevronDown />}
            </button>

            {isOpen && (
                <div className='absolute bottom-full left-0 mb-2 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden'>
                    <div className='p-2 text-xs text-zinc-500 border-b border-zinc-800'>{label}</div>
                    {models.map((model) => (
                        <button
                            key={model.id}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors cursor-pointer
                                ${selectedModel.id === model.id
                                    ? 'bg-zinc-800 text-zinc-100'
                                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                                }`}
                            onClick={() => {
                                onSelect(model)
                                setIsOpen(false)
                            }}
                        >
                            <div className='flex flex-col items-start'>
                                <span>{model.name}</span>
                                <span className='text-xs text-zinc-500'>{model.provider}</span>
                            </div>
                            {selectedModel.id === model.id && <IoCheckmark className='text-amber-500' />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ModelSelector
