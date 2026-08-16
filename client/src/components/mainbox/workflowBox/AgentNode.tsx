import { Handle, Position, type NodeProps } from '@xyflow/react'
import { IoPersonCircleOutline, IoLayersOutline, IoServerOutline } from 'react-icons/io5'
import type { FlowNode } from './workflowTypes'

export default function AgentNode({ data }: NodeProps<FlowNode>) {
    const agent = data.agent
    const kbCount = agent?.collection_ids.length ?? 0
    const mcpCount = agent?.mcp_server_ids.length ?? 0

    return (
        <div
            className={`relative w-44 rounded-lg bg-(--c-surface) text-(--c-text) border px-2.5 py-2 ${
                data.is_start ? 'border-2 border-(--c-accent)' : 'border-(--c-border)'
            }`}
        >
            <Handle type="target" position={Position.Left} className="wf-handle" />

            <div className="flex items-center gap-1.5 text-[11px] font-medium">
                {data.is_start && (
                    <span className="text-[8.5px] font-bold tracking-wider uppercase text-(--c-accent-hi) bg-(--c-accent)/15 border border-(--c-accent)/50 rounded px-1 py-px">
                        Start
                    </span>
                )}
                <IoPersonCircleOutline className="text-(--c-success) shrink-0" />
                <span className="truncate">{agent?.name.trim() || 'Untitled agent'}</span>
            </div>

            <div className="mt-0.5 text-[9.5px] text-(--c-text-muted) font-mono truncate">
                {data.subtitle}
            </div>

            {(kbCount > 0 || mcpCount > 0) && (
                <div className="mt-1 flex items-center gap-2 text-[9px] text-(--c-text-muted)">
                    {kbCount > 0 && (
                        <span className="flex items-center gap-0.5" title="Knowledgebases">
                            <IoLayersOutline /> {kbCount}
                        </span>
                    )}
                    {mcpCount > 0 && (
                        <span className="flex items-center gap-0.5" title="MCP servers">
                            <IoServerOutline /> {mcpCount}
                        </span>
                    )}
                </div>
            )}

            <Handle type="source" position={Position.Right} className="wf-handle" />
        </div>
    )
}
