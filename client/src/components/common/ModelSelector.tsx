import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select'

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

const triggerClassName =
    'h-auto w-fit gap-1 rounded-none border-0 bg-transparent p-0 text-sm text-(--c-text-muted) shadow-none hover:bg-transparent hover:text-(--c-text-body) focus-visible:ring-0 data-[size=default]:h-auto data-[size=sm]:h-auto [&_svg]:opacity-70'

function ModelSelector({ models, selectedModel, onSelect, label = 'Select a model' }: ModelSelectorProps) {
    return (
        <Select
            value={selectedModel.id}
            onValueChange={(id) => {
                const model = models.find((m) => m.id === id)
                if (model) onSelect(model)
            }}
        >
            <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder={label}>{selectedModel.name}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top" className="w-56">
                {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col items-start">
                            <span>{model.name}</span>
                            <span className="text-xs text-(--c-text-muted)">{model.provider}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export default ModelSelector
