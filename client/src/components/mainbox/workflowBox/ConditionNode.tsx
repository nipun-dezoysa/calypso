import { useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { IoGitBranchOutline } from 'react-icons/io5'
import { branchSummary, type FlowNode } from './workflowTypes'

export default function ConditionNode({ id, data }: NodeProps<FlowNode>) {
    const updateNodeInternals = useUpdateNodeInternals()
    const branches = data.branches
    const handleKey = branches.map((b) => b.id).join('|')

    useEffect(() => {
        updateNodeInternals(id)
    }, [id, handleKey, updateNodeInternals])

    return (
        <div
            className={`relative w-52 rounded-lg bg-zinc-900 text-zinc-200 border ${
                data.is_start ? 'border-2 border-amber-600' : 'border-zinc-700'
            }`}
        >
            <Handle type="target" position={Position.Left} className="wf-handle" />

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-[7px] bg-zinc-800/70 border-b border-zinc-700 text-[11px] font-medium">
                {data.is_start && (
                    <span className="text-[8.5px] font-bold tracking-wider uppercase text-amber-400 bg-amber-600/15 border border-amber-600/50 rounded px-1 py-px">
                        Start
                    </span>
                )}
                <IoGitBranchOutline className="text-sky-400 shrink-0" />
                Condition
            </div>

            {branches.map((branch, i) => (
                <div
                    key={branch.id}
                    className="relative flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-zinc-800 first:border-t-0"
                >
                    <span className="text-[10.5px] text-zinc-300 truncate">
                        {branch.label.trim() || `Branch ${i + 1}`}
                    </span>
                    <span className="text-[9.5px] text-zinc-500 font-mono truncate max-w-23.75">
                        {branchSummary(branch)}
                    </span>
                    <Handle
                        type="source"
                        id={branch.id}
                        position={Position.Right}
                        className="wf-handle"
                    />
                </div>
            ))}

            {branches.length === 0 && (
                <div className="px-2.5 py-2 text-[10px] text-zinc-600 italic">No branches</div>
            )}
        </div>
    )
}
