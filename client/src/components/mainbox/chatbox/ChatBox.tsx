import { useEffect, useRef } from 'react'
import BotMessage from './BotMessage'
import ChatInput from './ChatInput'
import UserMessage from './UserMessage'
import { useChatStore } from '../../../stores/ChatStore'

function ChatBox() {
    const selectedAgent = useChatStore((s) => s.selectedAgent)
    const threadId = useChatStore((s) => s.threadId)
    const threads = useChatStore((s) => s.threads)
    const messages = useChatStore((s) => s.messages)
    const sending = useChatStore((s) => s.sending)
    const loadingMessages = useChatStore((s) => s.loadingMessages)
    const error = useChatStore((s) => s.error)

    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, sending])

    const currentThread = threads.find((t) => t.id === threadId)
    const headerTitle = currentThread?.title
        ?? (selectedAgent ? `New chat · ${selectedAgent.name}` : 'Chat')

    function renderBody() {
        if (!selectedAgent) {
            return (
                <div className='flex-1 flex items-center justify-center text-zinc-500'>
                    Select an agent below to start chatting.
                </div>
            )
        }

        if (loadingMessages) {
            return (
                <div className='flex-1 flex items-center justify-center text-zinc-500 animate-pulse'>
                    Loading conversation…
                </div>
            )
        }

        if (messages.length === 0 && !sending) {
            return (
                <div className='flex-1 flex items-center justify-center text-zinc-500'>
                    Start a conversation with {selectedAgent.name}.
                </div>
            )
        }

        return (
            <div className='w-full flex-1 overflow-y-auto flex flex-col items-center'>
                <div className='w-1/2 flex flex-col gap-5 pt-15 pb-45'>
                    {messages.map((m) =>
                        m.is_bot
                            ? <BotMessage key={m.id} message={m.content} />
                            : <UserMessage key={m.id} message={m.content} />,
                    )}
                    {sending && (
                        <div className='text-zinc-500 text-sm animate-pulse'>Thinking…</div>
                    )}
                    {error && (
                        <div className='text-red-400 text-sm'>{error}</div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>
        )
    }

    return (
        <div className='relative h-full flex flex-col items-center'>
            <div className='absolute top-0 w-full text-zinc-300 px-5 py-2 bg-zinc-900 z-10 truncate'>
                {headerTitle}
            </div>
            {renderBody()}
            <ChatInput />
        </div>
    )
}

export default ChatBox
