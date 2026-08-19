import {
    IoAddOutline,
    IoArrowDownOutline,
    IoArrowUpOutline,
    IoTrashOutline,
} from 'react-icons/io5'
import type { ConditionOperator } from '../../../api/workflowApi'
import { OPERATORS, newBranch, type Branch } from './workflowTypes'
import { Input } from '../../ui/input'
import { Checkbox } from '../../ui/checkbox'
import { Label } from '../../ui/label'
import { Button } from '../../ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select'

interface BranchEditorProps {
    branches: Branch[]
    onChange: (branches: Branch[]) => void
    onRemoved: (branchId: string) => void
}

export default function BranchEditor({ branches, onChange, onRemoved }: BranchEditorProps) {
    function patch(id: string, changes: Partial<Branch>) {
        onChange(branches.map((b) => (b.id === id ? { ...b, ...changes } : b)))
    }

    function move(index: number, delta: number) {
        const to = index + delta
        if (to < 0 || to >= branches.length) return
        const next = [...branches]
        ;[next[index], next[to]] = [next[to], next[index]]
        onChange(next)
    }

    function remove(id: string) {
        onChange(branches.filter((b) => b.id !== id))
        onRemoved(id)
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label className="text-[11px] text-(--c-text-muted)">Branches</Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 gap-0.5 text-[11px] font-normal text-(--c-text-dim) hover:text-(--c-accent-hi) hover:bg-transparent"
                    onClick={() => onChange([...branches, newBranch()])}
                >
                    <IoAddOutline /> Add
                </Button>
            </div>

            <p className="text-[10px] text-(--c-text-subtle) leading-snug">
                Checked top to bottom against the incoming text; the first match decides where the
                run goes next. Wire each branch's dot to the node it should hand off to.
            </p>

            {branches.map((branch, i) => (
                <div
                    key={branch.id}
                    className="flex flex-col gap-1.5 border border-(--c-hover) rounded p-2 bg-(--c-surface)/40"
                >
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-(--c-text-subtle) font-mono w-3.5 shrink-0">
                            {i + 1}
                        </span>
                        <Input
                            className="h-7 text-[11px] px-2"
                            value={branch.label}
                            placeholder={`Branch ${i + 1}`}
                            onChange={(e) => patch(branch.id, { label: e.target.value })}
                            spellCheck={false}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-(--c-text-muted) hover:text-(--c-text) disabled:opacity-25 shrink-0"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            title="Check earlier"
                        >
                            <IoArrowUpOutline size={12} />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-(--c-text-muted) hover:text-(--c-text) disabled:opacity-25 shrink-0"
                            onClick={() => move(i, 1)}
                            disabled={i === branches.length - 1}
                            title="Check later"
                        >
                            <IoArrowDownOutline size={12} />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-(--c-danger) hover:text-(--c-danger-text) shrink-0"
                            onClick={() => remove(branch.id)}
                            title="Delete branch"
                        >
                            <IoTrashOutline size={12} />
                        </Button>
                    </div>

                    <Select
                        value={branch.operator}
                        onValueChange={(value) =>
                            patch(branch.id, { operator: value as ConditionOperator })
                        }
                    >
                        <SelectTrigger className="w-full h-7 text-[11px] px-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {OPERATORS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {branch.operator !== 'always' && (
                        <>
                            <Input
                                className="h-7 text-[11px] px-2"
                                value={branch.value}
                                placeholder={
                                    branch.operator === 'regex' ? '\\b(refund|invoice)\\b' : 'text to match'
                                }
                                onChange={(e) => patch(branch.id, { value: e.target.value })}
                                spellCheck={false}
                            />
                            <Label className="flex items-center gap-1.5 text-[10px] font-normal text-(--c-text-muted) cursor-pointer">
                                <Checkbox
                                    checked={branch.case_sensitive}
                                    onCheckedChange={(checked) =>
                                        patch(branch.id, { case_sensitive: checked === true })
                                    }
                                />
                                Match case
                            </Label>
                        </>
                    )}
                </div>
            ))}

            {branches.length === 0 && (
                <span className="text-[10px] text-(--c-danger-text)">
                    A condition node needs at least one branch to save.
                </span>
            )}
        </div>
    )
}
