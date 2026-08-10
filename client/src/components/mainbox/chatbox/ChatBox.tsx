import { useEffect, useRef } from 'react'
import type { ScrollAreaHandle } from '../../common/ScrollArea'
import BotMessage from './BotMessage'
import ChatInput from './ChatInput'
import UserMessage from './UserMessage'
import { useChatStore } from '../../../stores/ChatStore'
import CopyCurlButton from '../../common/CopyCurlButton'
import ScrollArea from '../../common/ScrollArea'

const STICKY_SCROLL_PX = 150

function ChatBox() {
    const targetId = useChatStore((s) => s.targetId)
    const targetName = useChatStore((s) => s.targetName)
    const threadId = useChatStore((s) => s.threadId)
    const threads = useChatStore((s) => s.threads)
    const messages = useChatStore((s) => s.messages)
    const sending = useChatStore((s) => s.sending)
    const loadingMessages = useChatStore((s) => s.loadingMessages)
    const error = useChatStore((s) => s.error)
    const streamingText = useChatStore((s) => s.streamingText)
    const streamingStep = useChatStore((s) => s.streamingStep)
    const streamingTool = useChatStore((s) => s.streamingTool)

    const bottomRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<ScrollAreaHandle>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, sending])

    useEffect(() => {
        if (!streamingText) return
        const viewport = scrollRef.current?.viewport
        if (!viewport) return
        const distance =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        if (distance < STICKY_SCROLL_PX) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' })
        }
    }, [streamingText])

    const currentThread = threads.find((t) => t.id === threadId)
    const headerTitle = currentThread?.title
        ?? (targetName ? `New chat · ${targetName}` : 'Chat')

    function renderBody() {
        if (!targetId) {
            return (
                <div className='flex-1 flex items-center justify-center text-zinc-500'>
                    Select an agent or workflow below to start chatting.
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
                    Start a conversation with {targetName}.
                </div>
            )
        }

        return (
          <ScrollArea
            ref={scrollRef}
            className="w-full flex-1"
            contentClassName="w-full flex flex-col items-center"
          >
            <div className="w-full px-4 max-w-4xl flex flex-col gap-5 pt-15 pb-45">
              {messages.map((m) =>
                m.is_bot ? (
                  <BotMessage key={m.id} message={m.content} />
                ) : (
                  <UserMessage
                    key={m.id}
                    message={m.content}
                    attachments={m.attachments}
                  />
                ),
              )}
              {sending && (
                <div className="flex flex-col gap-2">
                  {(streamingStep || streamingTool) && (
                    <div className="text-xs text-amber-500/80">
                      {streamingStep && <span>Step: {streamingStep}</span>}
                      {streamingStep && streamingTool && (
                        <span className="text-zinc-600"> · </span>
                      )}
                      {streamingTool && (
                        <span className="animate-pulse">
                          Running {streamingTool}…
                        </span>
                      )}
                    </div>
                  )}
                  {streamingText ? (
                    <BotMessage message={streamingText} />
                  ) : (
                    <div className="text-zinc-500 text-sm animate-pulse">
                      Thinking…
                    </div>
                  )}
                </div>
              )}
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        );
    }

    return (
        <div className='relative h-full flex flex-col items-center'>
            <div className='sticky top-0 w-full text-zinc-300 px-5 py-2 bg-zinc-900 z-10 flex items-center gap-3'>
                <span className='truncate'>{headerTitle}</span>
                {targetId && <CopyCurlButton targetId={targetId} className='ml-auto' />}
            </div>
            {renderBody()}
            <ChatInput />
        </div>
    )
}

export default ChatBox
