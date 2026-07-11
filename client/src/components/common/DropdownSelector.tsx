import { useState, useRef, useEffect } from 'react'
import { IoChevronDown, IoChevronUp, IoCheckmark } from 'react-icons/io5'

export interface SelectOption {
    id: string
    name: string
    description?: string
}

interface SingleSelectProps {
    options: SelectOption[]
    selected: SelectOption
    onSelect: (option: SelectOption) => void
    label?: string
    multiple?: false
}

interface MultiSelectProps {
    options: SelectOption[]
    selected: SelectOption[]
    onSelect: (options: SelectOption[]) => void
    label?: string
    multiple: true
}

type DropdownSelectorProps = SingleSelectProps | MultiSelectProps

function DropdownSelector(props: DropdownSelectorProps) {
    const { options, label = 'Select an option', multiple } = props
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

    const isSelected = (option: SelectOption) => {
        if (multiple) {
            return (props as MultiSelectProps).selected.some((s) => s.id === option.id)
        }
        return (props as SingleSelectProps).selected.id === option.id
    }

    const handleSelect = (option: SelectOption) => {
        if (multiple) {
            const multiProps = props as MultiSelectProps
            const alreadySelected = multiProps.selected.some((s) => s.id === option.id)
            if (alreadySelected) {
                multiProps.onSelect(multiProps.selected.filter((s) => s.id !== option.id))
            } else {
                multiProps.onSelect([...multiProps.selected, option])
            }
        } else {
            (props as SingleSelectProps).onSelect(option)
            setIsOpen(false)
        }
    }

    const displayText = () => {
        if (multiple) {
            const selected = (props as MultiSelectProps).selected
            if (selected.length === 0) return label
            if (selected.length === 1) return selected[0].name
            return `${selected.length} selected`
        }
        return (props as SingleSelectProps).selected.name
    }

    return (
        <div className='relative' ref={dropdownRef}>
            <button
                className='flex items-center gap-1 hover:text-zinc-300 transition-colors text-sm cursor-pointer'
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{displayText()}</span>
                {isOpen ? <IoChevronUp /> : <IoChevronDown />}
            </button>

            {isOpen && (
                <div className='absolute bottom-full left-0 mb-2 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden'>
                    <div className='p-2 text-xs text-zinc-500 border-b border-zinc-800'>{label}</div>
                    {options.map((option) => (
                        <button
                            key={option.id}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors cursor-pointer
                                ${isSelected(option)
                                    ? 'bg-zinc-800 text-zinc-100'
                                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                                }`}
                            onClick={() => handleSelect(option)}
                        >
                            <div className='flex flex-col items-start'>
                                <span>{option.name}</span>
                                {option.description && (
                                    <span className='text-xs text-zinc-500'>{option.description}</span>
                                )}
                            </div>
                            {isSelected(option) && <IoCheckmark className='text-amber-500' />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default DropdownSelector
