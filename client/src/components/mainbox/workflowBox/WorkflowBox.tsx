import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import {
    ReactFlow,
    Background,
    Controls,
    MarkerType,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    type Node,
    type Edge,
    type Connection,
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './workflow.css'
import {
    IoAddOutline,
    IoSaveOutline,
    IoTrashOutline,
    IoFlagOutline,
    IoCheckmarkCircle,
    IoChatbubbleEllipsesOutline,
} from 'react-icons/io5'
import { getWorkflow, replaceWorkflow, type WorkflowNode } from '../../../api/workflowApi'
import { listAgents, type Agent } from '../../../api/agentApi'
import ChatBox from '../chatbox/ChatBox'
import { useChatStore } from '../../../stores/ChatStore'

interface AgentData extends Record<string, unknown> {
    i_id: string | null
    is_start: boolean
    label: ReactNode
}

type FlowNode = Node<AgentData>

interface WorkflowBoxProps {
    workflowId: string
}

const START_STYLE = {
    border: '2px solid #d97706',
    borderRadius: 8,
    background: '#1c1917',
    color: '#e4e4e7',
    fontSize: 12,
    padding: 8,
}
const NODE_STYLE = {
    border: '1px solid #3f3f46',
    borderRadius: 8,
    background: '#18181b',
    color: '#e4e4e7',
    fontSize: 12,
    padding: 8,
}


const EDGE_MARKER = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#a1a1aa' }
const EDGE_STYLE = { stroke: '#a1a1aa' }

function labelFor(iId: string | null, agents: Agent[]): string {
    if (!iId) return 'Unassigned agent'
    const a = agents.find((x) => x.id === iId)
    return a ? a.name : 'Unknown agent'
}

const START_BADGE_STYLE = {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#fbbf24',
    background: 'rgba(217,119,6,0.15)',
    border: '1px solid rgba(217,119,6,0.5)',
    borderRadius: 4,
    padding: '1px 5px',
    textTransform: 'uppercase' as const,
    lineHeight: 1.4,
}

function makeData(iId: string | null, isStart: boolean, agents: Agent[]): AgentData {
    const name = labelFor(iId, agents)
    return {
        i_id: iId,
        is_start: isStart,
        label: isStart ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={START_BADGE_STYLE}>Start</span>
                {name}
            </span>
        ) : (
            name
        ),
    }
}

function toFlowNode(n: WorkflowNode, agents: Agent[]): FlowNode {
    return {
        id: n.id,
        position: { x: n.position_x, y: n.position_y },
        data: makeData(n.i_id, n.is_start, agents),
        style: n.is_start ? START_STYLE : NODE_STYLE,
    }
}

export default function WorkflowBox({ workflowId }: WorkflowBoxProps) {
    const [name, setName] = useState('')
    const [nodes, setNodes] = useState<FlowNode[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
    const [chatOpen, setChatOpen] = useState(false)

    const selectWorkflow = useChatStore((s) => s.selectWorkflow)

    // Point the shared chat at this workflow, then reveal the chat box.
    function toggleChat() {
        if (chatOpen) {
            setChatOpen(false)
            return
        }
        selectWorkflow({ id: workflowId, name: name.trim() || 'Untitled Workflow' })
        setChatOpen(true)
    }
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)

    // Load the workflow + agents.
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        Promise.all([getWorkflow(workflowId), listAgents({ limit: 100 })])
            .then(([wf, agentList]) => {
                if (cancelled) return
                setName(wf.name)
                setAgents(agentList)
                setNodes(wf.nodes.map((n) => toFlowNode(n, agentList)))
                setEdges(wf.edges.map((e) => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    markerEnd: EDGE_MARKER,
                    style: EDGE_STYLE,
                })))
            })
            .catch((err: unknown) => {
                if (!cancelled) setSaveError(err instanceof Error ? err.message : 'Failed to load workflow')
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [workflowId])

    const onNodesChange = useCallback(
        (changes: NodeChange<FlowNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    )
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    )
    // A connection is invalid if it loops a node to itself, or the two nodes are
    // already connected in either direction. Evaluated live during the drag so
    // React Flow shows it as invalid and blocks the drop.
    const isValidConnection = useCallback(
        (conn: Edge | Connection) => {
            if (!conn.source || !conn.target) return false
            if (conn.source === conn.target) return false
            return !edges.some(
                (e) =>
                    (e.source === conn.source && e.target === conn.target) ||
                    (e.source === conn.target && e.target === conn.source),
            )
        },
        [edges],
    )

    const onConnect = useCallback((params: Connection) => {
        if (params.source === params.target) return // a node cannot connect to itself
        setEdges((eds) => {
            const alreadyConnected = eds.some(
                (e) =>
                    (e.source === params.source && e.target === params.target) ||
                    (e.source === params.target && e.target === params.source),
            )
            if (alreadyConnected) return eds
            return addEdge({ ...params, markerEnd: EDGE_MARKER, style: EDGE_STYLE }, eds)
        })
    }, [])

    function addNode() {
        const id = crypto.randomUUID()
        const offset = nodes.length * 40
        setNodes((nds) => [
            ...nds,
            {
                id,
                position: { x: 120 + offset, y: 100 + offset },
                data: makeData(null, false, agents),
                style: NODE_STYLE,
            },
        ])
        setSelectedNodeId(id)
    }

    function setNodeAgent(iId: string | null) {
        if (!selectedNodeId) return
        setNodes((nds) =>
            nds.map((n) =>
                n.id === selectedNodeId
                    ? { ...n, data: makeData(iId, n.data.is_start, agents), style: n.data.is_start ? START_STYLE : NODE_STYLE }
                    : n,
            ),
        )
    }

    function makeStart(nodeId: string) {
        setNodes((nds) =>
            nds.map((n) => {
                const isStart = n.id === nodeId
                return { ...n, data: makeData(n.data.i_id, isStart, agents), style: isStart ? START_STYLE : NODE_STYLE }
            }),
        )
    }

    function deleteNode(nodeId: string) {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId))
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
        if (selectedNodeId === nodeId) setSelectedNodeId(null)
    }

    function deleteEdge(edgeId: string) {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId))
        if (selectedEdgeId === edgeId) setSelectedEdgeId(null)
    }

    async function handleSave() {
        setSaving(true)
        setSaveError(null)
        try {
            await replaceWorkflow(workflowId, {
                name: name.trim() || 'Untitled Workflow',
                nodes: nodes.map((n) => ({
                    id: n.id,
                    type: 'agent',
                    i_id: n.data.i_id,
                    is_start: n.data.is_start,
                    position_x: n.position.x,
                    position_y: n.position.y,
                })),
                edges: edges.map((e) => ({ source: e.source, target: e.target })),
            })
            setSavedAt(Date.now())
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save workflow')
        } finally {
            setSaving(false)
        }
    }

    const selectedNode = useMemo(
        () => nodes.find((n) => n.id === selectedNodeId) ?? null,
        [nodes, selectedNodeId],
    )

    const displayNodes = useMemo(
        () =>
            nodes.map((n) =>
                n.id === selectedNodeId
                    ? { ...n, style: { ...n.style, outline: '2px solid #f59e0b', outlineOffset: 2 } }
                    : n,
            ),
        [nodes, selectedNodeId],
    )
    const selectedEdge = useMemo(
        () => edges.find((e) => e.id === selectedEdgeId) ?? null,
        [edges, selectedEdgeId],
    )

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center text-zinc-500 text-sm gap-2">
                <span className="apm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Loading workflow…
            </div>
        )
    }

    return (
        <div className="h-full w-full flex">
            <div className={`relative h-full ${chatOpen ? 'w-1/2 border-r border-zinc-800' : 'w-full'}`}>
            {/* Toolbar */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded-lg px-3 py-2">
                <input
                    className="bg-transparent text-zinc-200 text-sm font-medium outline-none w-48 border-b border-transparent focus:border-zinc-600"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workflow name"
                    spellCheck={false}
                />
                <span className="text-[11px] text-zinc-600 font-mono">{nodes.length} nodes</span>
                <button
                    className="flex items-center gap-1 text-xs text-zinc-300 hover:text-amber-400 border border-zinc-700 rounded px-2 py-1"
                    onClick={addNode}
                >
                    <IoAddOutline /> Agent node
                </button>
                <button
                    className="flex items-center gap-1 text-xs text-white bg-amber-600 hover:bg-amber-700 rounded px-2.5 py-1 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <span className="ui-spinner" /> : <IoSaveOutline />} Save
                </button>
                {savedAt && !saveError && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <IoCheckmarkCircle /> Saved
                    </span>
                )}
            </div>

            {saveError && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-red-950/90 border border-red-800 text-red-300 text-xs rounded-lg px-3 py-2 max-w-md">
                    {saveError}
                </div>
            )}

            {/* Node properties panel */}
            {selectedNode && (
                <div className="absolute top-3 right-3 z-10 w-60 bg-zinc-950/95 border border-zinc-800 rounded-lg p-3 flex flex-col gap-3">
                    <div className="text-xs font-semibold text-zinc-300">Node</div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-zinc-500">Agent</label>
                        <select
                            className="bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs px-2 py-1.5 outline-none"
                            value={selectedNode.data.i_id ?? ''}
                            onChange={(e) => setNodeAgent(e.target.value || null)}
                        >
                            <option value="">Unassigned</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className={`flex items-center gap-1.5 text-xs rounded px-2 py-1.5 border ${
                            selectedNode.data.is_start
                                ? 'border-amber-600 text-amber-400 bg-amber-950/30'
                                : 'border-zinc-700 text-zinc-300 hover:border-amber-600 hover:text-amber-400'
                        }`}
                        onClick={() => makeStart(selectedNode.id)}
                        disabled={selectedNode.data.is_start}
                    >
                        <IoFlagOutline />
                        {selectedNode.data.is_start ? 'Start node' : 'Set as start'}
                    </button>
                    <button
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/60 rounded px-2 py-1.5"
                        onClick={() => deleteNode(selectedNode.id)}
                    >
                        <IoTrashOutline /> Delete node
                    </button>
                </div>
            )}

            {/* Edge properties panel */}
            {selectedEdge && (
                <div className="absolute top-3 right-3 z-10 w-60 bg-zinc-950/95 border border-zinc-800 rounded-lg p-3 flex flex-col gap-3">
                    <div className="text-xs font-semibold text-zinc-300">Connection</div>
                    <button
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/60 rounded px-2 py-1.5"
                        onClick={() => deleteEdge(selectedEdge.id)}
                    >
                        <IoTrashOutline /> Delete edge
                    </button>
                    <span className="text-[11px] text-zinc-600">Tip: select an edge and press Delete.</span>
                </div>
            )}

            <ReactFlow
                nodes={displayNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                isValidConnection={isValidConnection}
                onNodeClick={(_e, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null) }}
                onEdgeClick={(_e, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null) }}
                onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
                deleteKeyCode={['Delete', 'Backspace']}
                fitView
            >
                <Background />
                <Controls />
            </ReactFlow>

            {/* Bottom-center chat toggle */}
            <button
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-full px-4 py-2 shadow-lg shadow-black/40"
                onClick={toggleChat}
            >
                <IoChatbubbleEllipsesOutline size={16} />
                {chatOpen ? 'Hide Chat' : 'Chat'}
            </button>
            </div>

            {chatOpen && (
                <div className="w-1/2 h-full border-l border-zinc-800">
                    <ChatBox />
                </div>
            )}
        </div>
    )
}
