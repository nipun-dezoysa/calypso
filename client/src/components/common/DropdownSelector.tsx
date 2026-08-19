import { IoChevronDown } from 'react-icons/io5'
import { Button } from '../ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu'

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

const triggerClassName =
    'h-auto w-fit gap-1 rounded-none border-0 bg-transparent p-0 text-sm shadow-none hover:bg-transparent hover:text-(--c-text-body) focus-visible:ring-0 data-[size=default]:h-auto data-[size=sm]:h-auto [&_svg]:opacity-70'

function DropdownSelector(props: DropdownSelectorProps) {
    const { options, label = 'Select an option', multiple } = props

    if (multiple) {
        const { selected, onSelect } = props

        const displayText = (() => {
            if (selected.length === 0) return label
            if (selected.length === 1) return selected[0].name
            return `${selected.length} selected`
        })()

        const toggleOption = (option: SelectOption, checked: boolean) => {
            if (checked) {
                onSelect([...selected, option])
            } else {
                onSelect(selected.filter((s) => s.id !== option.id))
            }
        }

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={triggerClassName}>
                        <span>{displayText}</span>
                        <IoChevronDown />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs text-(--c-text-muted)">
                        {label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {options.map((option) => {
                        const checked = selected.some((s) => s.id === option.id)
                        return (
                            <DropdownMenuCheckboxItem
                                key={option.id}
                                checked={checked}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(isChecked) => toggleOption(option, isChecked)}
                            >
                                <div className="flex flex-col items-start">
                                    <span>{option.name}</span>
                                    {option.description && (
                                        <span className="text-xs text-(--c-text-muted)">
                                            {option.description}
                                        </span>
                                    )}
                                </div>
                            </DropdownMenuCheckboxItem>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    const { selected, onSelect } = props

    return (
        <Select
            value={selected.id}
            onValueChange={(id) => {
                const option = options.find((o) => o.id === id)
                if (option) onSelect(option)
            }}
        >
            <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder={label}>{selected.name}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top" className="w-56">
                {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                        <div className="flex flex-col items-start">
                            <span>{option.name}</span>
                            {option.description && (
                                <span className="text-xs text-(--c-text-muted)">
                                    {option.description}
                                </span>
                            )}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export default DropdownSelector
