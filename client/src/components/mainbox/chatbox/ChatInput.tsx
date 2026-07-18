import { useEffect, useState } from 'react'
import { IoArrowUp } from 'react-icons/io5'
import DropdownSelector, { type SelectOption } from '../../common/DropdownSelector'
import { listAgents, updateAgent, type Agent } from '../../../api/agentApi'
import { listCollections, type Collection } from '../../../api/kbApi'
import { listMcpServers, type McpServer } from '../../../api/mcpApi'
import { useChatStore } from '../../../stores/ChatStore'

const AGENT_PLACEHOLDER: SelectOption = { id: '', name: 'Select an agent' }

function ChatInput() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [collections, setCollections] = useState<Collection[]>([])
    const [mcpServers, setMcpServers] = useState<McpServer[]>([])
    const [text, setText] = useState('')
    const [savingKBs, setSavingKBs] = useState(false)
    const [savingMcps, setSavingMcps] = useState(false)

    const targetId = useChatStore((s) => s.targetId)
    const targetType = useChatStore((s) => s.targetType)
    const targetName = useChatStore((s) => s.targetName)
    const selectedAgent = useChatStore((s) => s.selectedAgent)
    const selectAgent = useChatStore((s) => s.selectAgent)
    const patchSelectedAgent = useChatStore((s) => s.patchSelectedAgent)
    const sendMessage = useChatStore((s) => s.sendMessage)
    const sending = useChatStore((s) => s.sending)

    useEffect(() => {
        let cancelled = false
        listAgents({ limit: 100 })
            .then((data) => {
                if (cancelled) return
                setAgents(data)
                const current = useChatStore.getState().targetId
                if (!current && data.length > 0) selectAgent(data[0])
            })
            .catch(() => {
                // Agent list failures already surface in the sidebar.
            })
        return () => {
            cancelled = true
        }
    }, [selectAgent])

    useEffect(() => {
        let cancelled = false
        listCollections({ limit: 100 })
            .then((data) => { if (!cancelled) setCollections(data) })
            .catch(() => {
                // Non-critical: the KB picker just stays empty on failure.
            })
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        let cancelled = false
        listMcpServers({ limit: 100 })
            .then((data) => { if (!cancelled) setMcpServers(data) })
            .catch(() => {
                // Non-critical: the MCP picker just stays empty on failure.
            })
        return () => { cancelled = true }
    }, [])

    const kbOptions: SelectOption[] = collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: `${c.document_count} doc${c.document_count === 1 ? '' : 's'}`,
    }))

    const selectedKBs: SelectOption[] = (selectedAgent?.collections ?? []).map((c) => ({
        id: c.id,
        name: c.name,
    }))

    async function handleChangeKBs(options: SelectOption[]) {
        if (!selectedAgent || savingKBs) return
        const collection_ids = options.map((o) => o.id)
        setSavingKBs(true)
        try {
            const updated = await updateAgent(selectedAgent.id, { collection_ids })
            patchSelectedAgent(updated)
            setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        } catch {
            // Keep the previous selection on failure; nothing to persist.
        } finally {
            setSavingKBs(false)
        }
    }

    const mcpOptions: SelectOption[] = mcpServers.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.transport,
    }))

    const selectedMcpOptions: SelectOption[] = (selectedAgent?.mcp_servers ?? []).map((s) => ({
        id: s.id,
        name: s.name,
    }))

    async function handleChangeMcps(options: SelectOption[]) {
        if (!selectedAgent || savingMcps) return
        const mcp_server_ids = options.map((o) => o.id)
        setSavingMcps(true)
        try {
            const updated = await updateAgent(selectedAgent.id, { mcp_server_ids })
            patchSelectedAgent(updated)
            setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        } catch {
            // Keep the previous selection on failure; nothing to persist.
        } finally {
            setSavingMcps(false)
        }
    }

    const agentOptions: SelectOption[] = agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: `${a.llm_model.provider_name} · ${a.llm_model.model_name}`,
    }))

    const selectedOption: SelectOption = targetId
        ? { id: targetId, name: targetName ?? '' }
        : AGENT_PLACEHOLDER

    const canSend = Boolean(targetId) && text.trim().length > 0 && !sending

    function handleSend() {
        if (!canSend) return
        const question = text.trim()
        setText('')
        void sendMessage(question)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className='w-full px-4 absolute left-0 bottom-0 flex items-center justify-center pb-5 flex-col'>
            <div className=' bg-zinc-950 w-full max-w-4xl rounded-2xl p-3'>
                <textarea
                    className='w-full bg-transparent focus:outline-none text-zinc-300 resize-none placeholder:text-zinc-500'
                    placeholder={targetId ? 'Type your message here...' : 'Select an agent or workflow to start chatting...'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!targetId}
                >
                </textarea>
                <div className='flex justify-between text-zinc-500 items-center'>
                    <div className='flex items-center gap-2'>
                        <DropdownSelector
                            options={agentOptions}
                            selected={selectedOption}
                            onSelect={(option) => {
                                const agent = agents.find((a) => a.id === option.id)
                                if (agent) selectAgent(agent)
                            }}
                            label='Select an agent'
                        />
                        {targetType === 'workflow' && (
                            <span className='text-[11px] text-amber-500/80 border border-amber-700/40 rounded px-1.5 py-0.5'>
                                Workflow
                            </span>
                        )}
                        {targetType === 'agent' && (
                            <>
                                <span className='text-zinc-600'>·</span>
                                <DropdownSelector
                                    options={kbOptions}
                                    selected={selectedKBs}
                                    onSelect={handleChangeKBs}
                                    label='Knowledgebases'
                                    multiple
                                />
                                <span className='text-zinc-600'>·</span>
                                <DropdownSelector
                                    options={mcpOptions}
                                    selected={selectedMcpOptions}
                                    onSelect={handleChangeMcps}
                                    label='MCP Servers'
                                    multiple
                                />
                            </>
                        )}
                    </div>
                    <button
                        className={`p-2 rounded-sm text-white ${canSend ? 'bg-amber-600 cursor-pointer' : 'bg-zinc-700 cursor-not-allowed'}`}
                        onClick={handleSend}
                        disabled={!canSend}
                        aria-label='Send message'
                    >
                        <IoArrowUp />
                    </button>
                </div>
            </div>
            <div className='text-zinc-500 text-xs pt-2'>AI models can make mistakes. Check important info.</div>
        </div>
    )
}

export default ChatInput
