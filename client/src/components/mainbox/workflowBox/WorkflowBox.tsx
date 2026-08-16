import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    ReactFlow,
    Background,
    Controls,
    MarkerType,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
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
    IoGitBranchOutline,
    IoSparklesOutline,
    IoArrowUndoOutline,
} from 'react-icons/io5'
import {
    getWorkflow,
    replaceWorkflow,
    type AgentNodeInput,
    type ConditionInput,
    type WorkflowAgentNode,
    type WorkflowCondition,
    type WorkflowEdge,
    type WorkflowNode,
    type WorkflowReplace,
} from '../../../api/workflowApi'
import type { ProposedWorkflow } from '../../../api/workflowDesignerApi'
import { listAgents, type Agent } from '../../../api/agentApi'
import { listAIProviders, type AIProvider } from '../../../api/aiProviderApi'
import { listCollections, type Collection } from '../../../api/kbApi'
import { listMcpServers, type McpServer } from '../../../api/mcpApi'
import ChatBox from '../chatbox/ChatBox'
import CopyCurlButton from '../../common/CopyCurlButton'
import { useChatStore } from '../../../stores/ChatStore'
import ConditionNode from './ConditionNode'
import AgentNode from './AgentNode'
import BranchEditor from './BranchEditor'
import AgentNodeEditor from './AgentNodeEditor'
import DesignerPanel from './DesignerPanel'
import {
    newAgentConfig,
    newBranch,
    type AgentConfig,
    type Branch,
    type FlowNode,
    type FlowNodeData,
} from './workflowTypes'

interface WorkflowBoxProps {
    workflowId: string
}

// Both node types paint their own chrome, so React Flow gets a bare wrapper.
const BARE_STYLE = {}

const EDGE_MARKER = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#a1a1aa' }
const EDGE_STYLE = { stroke: '#a1a1aa' }

const NODE_TYPES = { condition: ConditionNode, agent: AgentNode }

/** The "built from" line under an agent node's name. */
function subtitleFor(
    config: AgentConfig | null,
    agents: Agent[],
    providers: AIProvider[],
): string {
    if (!config) return 'Not configured'
    const base = agents.find((a) => a.id === config.agent_id)
    const model = providers
        .flatMap((p) => p.models)
        .find((m) => m.id === config.llm_model_id)
    if (base && model) return `${base.name} · ${model.model_name}`
    if (base) return `${base.name} · ${base.llm_model.model_name}`
    if (model) return model.model_name
    return config.agent_id ? 'Unknown agent' : 'No model'
}

function makeData(
    kind: FlowNodeData['kind'],
    isStart: boolean,
    agent: AgentConfig | null,
    branches: Branch[],
    agents: Agent[],
    providers: AIProvider[],
): FlowNodeData {
    return {
        kind,
        is_start: isStart,
        agent: kind === 'agent' ? agent : null,
        branches: kind === 'condition' ? branches : [],
        subtitle: kind === 'agent' ? subtitleFor(agent, agents, providers) : '',
    }
}

function toFlowNode(
    n: WorkflowNode,
    agent: AgentConfig | null,
    branches: Branch[],
    agents: Agent[],
    providers: AIProvider[],
): FlowNode {
    return {
        id: n.id,
        type: n.type,
        position: { x: n.position_x, y: n.position_y },
        data: makeData(n.type, n.is_start, agent, branches, agents, providers),
        style: BARE_STYLE,
    }
}

function toAgentConfig(a: WorkflowAgentNode): AgentConfig {
    return {
        id: a.id,
        name: a.name,
        agent_id: a.agent_id,
        llm_model_id: a.llm_model_id,
        node_instructions: a.node_instructions,
        output_instructions: a.output_instructions,
        creativity: a.creativity,
        markdown_enabled: a.markdown_enabled,
        collection_ids: a.collection_ids,
        mcp_server_ids: a.mcp_server_ids,
    }
}

interface Graph {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    conditions: WorkflowCondition[]
    agent_nodes: WorkflowAgentNode[]
}

function toCanvas(
    graph: Graph,
    agents: Agent[],
    providers: AIProvider[],
): { nodes: FlowNode[]; edges: Edge[] } {
    const branchesByNode = groupBranches(graph.conditions)
    const agentByNode = new Map(
        graph.agent_nodes.map((a) => [a.n_id, toAgentConfig(a)] as const),
    )
    return {
        nodes: graph.nodes.map((n) =>
            toFlowNode(
                n,
                agentByNode.get(n.id) ?? null,
                branchesByNode.get(n.id) ?? [],
                agents,
                providers,
            ),
        ),
        edges: graph.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.source_handle,
            markerEnd: EDGE_MARKER,
            style: EDGE_STYLE,
        })),
    }
}

function serializeGraph(name: string, nodes: FlowNode[], edges: Edge[]): WorkflowReplace {
    return {
        name: name.trim() || 'Untitled Workflow',
        nodes: nodes.map((n) => ({
            id: n.id,
            type: n.data.kind,
            is_start: n.data.is_start,
            position_x: n.position.x,
            position_y: n.position.y,
        })),
        edges: edges.map((e) => ({
            source: e.source,
            target: e.target,
            source_handle: e.sourceHandle ?? null,
        })),
        conditions: nodes.flatMap<ConditionInput>((n) =>
            n.data.kind === 'condition'
                ? n.data.branches.map((b, i) => ({
                      id: b.id,
                      n_id: n.id,
                      label: b.label.trim(),
                      operator: b.operator,
                      value: b.operator === 'always' ? null : b.value,
                      case_sensitive: b.case_sensitive,
                      order_index: i,
                  }))
                : [],
        ),
        agent_nodes: nodes.flatMap<AgentNodeInput>((n) =>
            n.data.kind === 'agent' && n.data.agent
                ? [{ ...n.data.agent, n_id: n.id, name: n.data.agent.name.trim() }]
                : [],
        ),
    }
}

function groupBranches(conditions: WorkflowCondition[]): Map<string, Branch[]> {
    const byNode = new Map<string, Branch[]>()
    for (const c of [...conditions].sort((a, b) => a.order_index - b.order_index)) {
        const list = byNode.get(c.n_id) ?? []
        list.push({
            id: c.id,
            label: c.label,
            operator: c.operator,
            value: c.value ?? '',
            case_sensitive: c.case_sensitive,
        })
        byNode.set(c.n_id, list)
    }
    return byNode
}

export default function WorkflowBox({ workflowId }: WorkflowBoxProps) {
    const [name, setName] = useState('')
    const [nodes, setNodes] = useState<FlowNode[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [providers, setProviders] = useState<AIProvider[]>([])
    const [collections, setCollections] = useState<Collection[]>([])
    const [mcpServers, setMcpServers] = useState<McpServer[]>([])
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
    const [chatOpen, setChatOpen] = useState(false)
    const [designerOpen, setDesignerOpen] = useState(false)
    const [beforeDesign, setBeforeDesign] = useState<
        { name: string; nodes: FlowNode[]; edges: Edge[] } | null
    >(null)

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

    // Load the workflow plus everything an agent node can be built from.
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        Promise.all([
            getWorkflow(workflowId),
            listAgents({ limit: 100 }),
            listAIProviders({ limit: 100 }),
            listCollections({ limit: 100 }),
            listMcpServers({ limit: 100 }),
        ])
            .then(([wf, agentList, providerList, collectionList, serverList]) => {
                if (cancelled) return
                const canvas = toCanvas(wf, agentList, providerList)
                setName(wf.name)
                setAgents(agentList)
                setProviders(providerList)
                setCollections(collectionList)
                setMcpServers(serverList)
                setNodes(canvas.nodes)
                setEdges(canvas.edges)
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

    const isValidConnection = useCallback(
        (conn: Edge | Connection) => {
            if (!conn.source || !conn.target) return false
            if (conn.source === conn.target) return false
            return !edges.some(
                (e) =>
                    (e.source === conn.source &&
                        e.target === conn.target &&
                        (e.sourceHandle ?? null) === (conn.sourceHandle ?? null)) ||
                    (e.source === conn.target && e.target === conn.source),
            )
        },
        [edges],
    )

    const onConnect = useCallback((params: Connection) => {
        if (params.source === params.target) return // a node cannot connect to itself
        setEdges((eds) => {
            const clashes = eds.some(
                (e) =>
                    (e.source === params.source &&
                        e.target === params.target &&
                        (e.sourceHandle ?? null) === (params.sourceHandle ?? null)) ||
                    (e.source === params.target && e.target === params.source),
            )
            if (clashes) return eds
            return addEdge({ ...params, markerEnd: EDGE_MARKER, style: EDGE_STYLE }, eds)
        })
    }, [])

    function addNode(kind: FlowNodeData['kind']) {
        const id = crypto.randomUUID()
        const offset = nodes.length * 40
        const branches =
            kind === 'condition'
                ? [newBranch({ label: 'Match' }), newBranch({ label: 'Otherwise', operator: 'always' })]
                : []
        // Every agent node owns a config from the moment it exists — that is what
        // makes it an agent defined *in* the workflow rather than a pointer out.
        const agent = kind === 'agent' ? newAgentConfig() : null
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: kind,
                position: { x: 120 + offset, y: 100 + offset },
                data: makeData(kind, false, agent, branches, agents, providers),
                style: BARE_STYLE,
            },
        ])
        setSelectedNodeId(id)
        setSelectedEdgeId(null)
    }

    function patchNode(nodeId: string, changes: Partial<FlowNodeData>) {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id !== nodeId) return n
                const next = { ...n.data, ...changes }
                return {
                    ...n,
                    data: makeData(next.kind, next.is_start, next.agent, next.branches, agents, providers),
                }
            }),
        )
    }

    function patchAgent(changes: Partial<AgentConfig>) {
        if (!selectedNodeId) return
        const current = nodes.find((n) => n.id === selectedNodeId)?.data.agent
        if (!current) return
        patchNode(selectedNodeId, { agent: { ...current, ...changes } })
    }

    function setBranches(branches: Branch[]) {
        if (selectedNodeId) patchNode(selectedNodeId, { branches })
    }

    /** A deleted branch takes the edges leaving its handle with it. */
    function dropBranchEdges(branchId: string) {
        setEdges((eds) => eds.filter((e) => e.sourceHandle !== branchId))
    }

    function makeStart(nodeId: string) {
        setNodes((nds) =>
            nds.map((n) => {
                const isStart = n.id === nodeId
                return {
                    ...n,
                    data: makeData(n.data.kind, isStart, n.data.agent, n.data.branches, agents, providers),
                }
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
            await replaceWorkflow(workflowId, serializeGraph(name, nodes, edges))
            setSavedAt(Date.now())
            // The canvas and the database agree again, so there is nothing left
            // to undo back to.
            setBeforeDesign(null)
        } catch (err: unknown) {
            setSaveError(readError(err))
        } finally {
            setSaving(false)
        }
    }

    function applyProposal(proposal: ProposedWorkflow) {
        setBeforeDesign({ name, nodes, edges })
        const canvas = toCanvas(proposal, agents, providers)
        setName(proposal.name)
        setNodes(canvas.nodes)
        setEdges(canvas.edges)
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
        setSavedAt(null)
        setSaveError(null)
    }

    function undoDesign() {
        if (!beforeDesign) return
        setName(beforeDesign.name)
        setNodes(beforeDesign.nodes)
        setEdges(beforeDesign.edges)
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
        setBeforeDesign(null)
    }

    const saveRef = useRef<() => void>(() => {})
    useEffect(() => {
        saveRef.current = () => {
            if (loading || saving) return
            void handleSave()
        }
    })

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return
            if (e.key !== 's' && e.key !== 'S') return
            e.preventDefault()
            saveRef.current()
        }
        window.addEventListener('keydown', onKeyDown, { capture: true })
        return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
    }, [])

    const selectedNode = useMemo(
        () => nodes.find((n) => n.id === selectedNodeId) ?? null,
        [nodes, selectedNodeId],
    )

    const displayNodes = useMemo(
        () =>
            nodes.map((n) =>
                n.id === selectedNodeId
                    ? { ...n, style: { ...n.style, outline: '2px solid #f59e0b', outlineOffset: 2, borderRadius: 8 } }
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
            <div className="h-full w-full flex items-center justify-center text-(--c-text-muted) text-sm gap-2">
                <span className="apm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Loading workflow…
            </div>
        )
    }

    return (
        <div className="h-full w-full flex">
            <div className="relative h-full flex-1 min-w-0">
            {/* Toolbar */}
            <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] flex flex-wrap items-center gap-2 bg-(--c-bg)/90 border border-(--c-hover) rounded-lg px-3 py-2">
                <input
                    className="bg-transparent text-(--c-text) text-sm font-medium outline-none w-40 border-b border-transparent focus:border-(--c-text-subtle)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workflow name"
                    spellCheck={false}
                />
                <span className="text-[11px] text-(--c-text-subtle) font-mono">{nodes.length} nodes</span>
                <button
                    className="flex items-center gap-1 text-xs text-(--c-text-body) hover:text-(--c-accent-hi) border border-(--c-border) rounded px-2 py-1"
                    onClick={() => addNode('agent')}
                >
                    <IoAddOutline /> Agent node
                </button>
                <button
                    className="flex items-center gap-1 text-xs text-(--c-text-body) hover:text-sky-400 border border-(--c-border) rounded px-2 py-1"
                    onClick={() => addNode('condition')}
                >
                    <IoGitBranchOutline /> Condition node
                </button>
                <button
                    className="flex items-center gap-1 text-xs text-white bg-(--c-accent) hover:bg-(--c-accent-lo) rounded px-2.5 py-1 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                    title="Save workflow (Ctrl+S)"
                >
                    {saving ? <span className="ui-spinner" /> : <IoSaveOutline />} Save
                </button>
                <button
                    className={`flex items-center gap-1 text-xs border rounded px-2 py-1 ${
                        designerOpen
                            ? 'border-(--c-accent) text-(--c-accent-hi) bg-(--c-accent)/30'
                            : 'border-(--c-border) text-(--c-text-body) hover:text-(--c-accent-hi)'
                    }`}
                    onClick={() => setDesignerOpen((open) => !open)}
                    title="Describe the workflow you want and have it drafted for you"
                >
                    <IoSparklesOutline /> Designer
                </button>
                {beforeDesign && (
                    <button
                        className="flex items-center gap-1 text-xs text-(--c-text-body) hover:text-(--c-accent-hi) border border-(--c-border) rounded px-2 py-1"
                        onClick={undoDesign}
                        title="Put the canvas back the way it was before the designer changed it"
                    >
                        <IoArrowUndoOutline /> Undo design
                    </button>
                )}
                <CopyCurlButton targetId={workflowId} />
                {savedAt && !saveError && (
                    <span className="flex items-center gap-1 text-[11px] text-(--c-success)">
                        <IoCheckmarkCircle /> Saved
                    </span>
                )}
            </div>

            {saveError && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-(--c-danger)/90 border border-(--c-danger-border-solid) text-(--c-danger-text) text-xs rounded-lg px-3 py-2 max-w-md">
                    {saveError}
                </div>
            )}

            {/* Node properties panel */}
            {selectedNode && (
                <div className="absolute top-3 right-3 z-10 w-64 max-h-[calc(100%-1.5rem)] overflow-y-auto bg-(--c-bg)/95 border border-(--c-hover) rounded-lg p-3 flex flex-col gap-3">
                    <div className="text-xs font-semibold text-(--c-text-body)">
                        {selectedNode.data.kind === 'condition' ? 'Condition' : 'Agent node'}
                    </div>

                    {selectedNode.data.kind === 'condition' ? (
                        <BranchEditor
                            branches={selectedNode.data.branches}
                            onChange={setBranches}
                            onRemoved={dropBranchEdges}
                        />
                    ) : (
                        selectedNode.data.agent && (
                            <AgentNodeEditor
                                config={selectedNode.data.agent}
                                onChange={patchAgent}
                                agents={agents}
                                providers={providers}
                                collections={collections}
                                mcpServers={mcpServers}
                            />
                        )
                    )}

                    <button
                        className={`flex items-center gap-1.5 text-xs rounded px-2 py-1.5 border ${
                            selectedNode.data.is_start
                                ? 'border-(--c-accent) text-(--c-accent-hi) bg-(--c-accent)/30'
                                : 'border-(--c-border) text-(--c-text-body) hover:border-(--c-accent) hover:text-(--c-accent-hi)'
                        }`}
                        onClick={() => makeStart(selectedNode.id)}
                        disabled={selectedNode.data.is_start}
                    >
                        <IoFlagOutline />
                        {selectedNode.data.is_start ? 'Start node' : 'Set as start'}
                    </button>
                    <button
                        className="flex items-center gap-1.5 text-xs text-(--c-danger-text) hover:text-(--c-danger-text) border border-(--c-danger)/60 rounded px-2 py-1.5"
                        onClick={() => deleteNode(selectedNode.id)}
                    >
                        <IoTrashOutline /> Delete node
                    </button>
                </div>
            )}

            {/* Edge properties panel */}
            {selectedEdge && (
                <div className="absolute top-3 right-3 z-10 w-60 bg-(--c-bg)/95 border border-(--c-hover) rounded-lg p-3 flex flex-col gap-3">
                    <div className="text-xs font-semibold text-(--c-text-body)">Connection</div>
                    <button
                        className="flex items-center gap-1.5 text-xs text-(--c-danger-text) hover:text-(--c-danger-text) border border-(--c-danger)/60 rounded px-2 py-1.5"
                        onClick={() => deleteEdge(selectedEdge.id)}
                    >
                        <IoTrashOutline /> Delete edge
                    </button>
                    <span className="text-[11px] text-(--c-text-subtle)">Tip: select an edge and press Delete.</span>
                </div>
            )}

            <ReactFlow
                nodes={displayNodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
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
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 text-sm text-white bg-(--c-accent) hover:bg-(--c-accent-lo) rounded-full px-4 py-2 shadow-lg shadow-black/40"
                onClick={toggleChat}
            >
                <IoChatbubbleEllipsesOutline size={16} />
                {chatOpen ? 'Hide Chat' : 'Chat'}
            </button>
            </div>

            {chatOpen && (
                <div className="w-1/2 h-full border-l border-(--c-hover)">
                    <ChatBox />
                </div>
            )}

            <div className={designerOpen ? 'w-88 shrink-0 h-full border-l border-(--c-hover)' : 'hidden'}>
                <DesignerPanel
                    providers={providers}
                    getGraph={() => serializeGraph(name, nodes, edges)}
                    onApply={applyProposal}
                    onClose={() => setDesignerOpen(false)}
                />
            </div>
        </div>
    )
}

/** Surface the server's graph-validation message rather than a bare "400". */
function readError(err: unknown): string {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
        const messages = detail
            .map((d: { msg?: string }) => d?.msg?.replace(/^Value error, /, ''))
            .filter(Boolean)
        if (messages.length) return messages.join('; ')
    }
    return err instanceof Error ? err.message : 'Failed to save workflow'
}
