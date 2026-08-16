import {
    IoAddOutline,
    IoArrowDownOutline,
    IoArrowUpOutline,
    IoTrashOutline,
} from 'react-icons/io5'
import type { ConditionOperator } from '../../../api/workflowApi'
import { OPERATORS, newBranch, type Branch } from './workflowTypes'

interface BranchEditorProps {
    branches: Branch[]
    onChange: (branches: Branch[]) => void
    onRemoved: (branchId: string) => void
}

const FIELD =
    'w-full bg-(--c-surface) border border-(--c-border) rounded text-(--c-text) text-[11px] px-1.5 py-1 outline-none focus:border-(--c-text-muted)'

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
                <label className="text-[11px] text-(--c-text-muted)">Branches</label>
                <button
                    className="flex items-center gap-0.5 text-[11px] text-(--c-text-dim) hover:text-(--c-accent-hi)"
                    onClick={() => onChange([...branches, newBranch()])}
                >
                    <IoAddOutline /> Add
                </button>
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
                        <input
                            className={FIELD}
                            value={branch.label}
                            placeholder={`Branch ${i + 1}`}
                            onChange={(e) => patch(branch.id, { label: e.target.value })}
                            spellCheck={false}
                        />
                        <button
                            className="text-(--c-text-muted) hover:text-(--c-text) disabled:opacity-25 shrink-0"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            title="Check earlier"
                        >
                            <IoArrowUpOutline size={12} />
                        </button>
                        <button
                            className="text-(--c-text-muted) hover:text-(--c-text) disabled:opacity-25 shrink-0"
                            onClick={() => move(i, 1)}
                            disabled={i === branches.length - 1}
                            title="Check later"
                        >
                            <IoArrowDownOutline size={12} />
                        </button>
                        <button
                            className="text-(--c-danger) hover:text-(--c-danger-text) shrink-0"
                            onClick={() => remove(branch.id)}
                            title="Delete branch"
                        >
                            <IoTrashOutline size={12} />
                        </button>
                    </div>

                    <select
                        className={FIELD}
                        value={branch.operator}
                        onChange={(e) =>
                            patch(branch.id, { operator: e.target.value as ConditionOperator })
                        }
                    >
                        {OPERATORS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>

                    {branch.operator !== 'always' && (
                        <>
                            <input
                                className={FIELD}
                                value={branch.value}
                                placeholder={
                                    branch.operator === 'regex' ? '\\b(refund|invoice)\\b' : 'text to match'
                                }
                                onChange={(e) => patch(branch.id, { value: e.target.value })}
                                spellCheck={false}
                            />
                            <label className="flex items-center gap-1.5 text-[10px] text-(--c-text-muted) cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="accent-(--c-accent)"
                                    checked={branch.case_sensitive}
                                    onChange={(e) =>
                                        patch(branch.id, { case_sensitive: e.target.checked })
                                    }
                                />
                                Match case
                            </label>
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
