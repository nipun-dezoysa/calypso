import { useEffect, useRef } from 'react'
import type { ScrollAreaHandle } from '../../common/ScrollArea'
import BotMessage from './BotMessage'
import ChatInput from './ChatInput'
import UserMessage from './UserMessage'
import { isSyntheticMessageId, useChatStore } from '../../../stores/ChatStore'
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
    const regenerateMessage = useChatStore((s) => s.regenerateMessage)
    const editMessage = useChatStore((s) => s.editMessage)

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
                <div className='flex-1 flex items-center justify-center text-(--c-text-muted)'>
                    Select an agent or workflow below to start chatting.
                </div>
            )
        }

        if (loadingMessages) {
            return (
                <div className='flex-1 flex items-center justify-center text-(--c-text-muted) animate-pulse'>
                    Loading conversation…
                </div>
            )
        }

        if (messages.length === 0 && !sending) {
            return (
                <div className='flex-1 flex items-center justify-center text-(--c-text-muted)'>
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
              {messages.map((m, i) => {
                const hasRealId = !isSyntheticMessageId(m.id)
                return m.is_bot ? (
                  <BotMessage
                    key={m.id}
                    message={m.content}
                    messageId={m.id}
                    canRegenerate={hasRealId && i === messages.length - 1 && !sending}
                    onRegenerate={() => void regenerateMessage(m.id)}
                    busy={sending}
                  />
                ) : (
                  <UserMessage
                    key={m.id}
                    message={m.content}
                    messageId={m.id}
                    attachments={m.attachments}
                    canEdit={hasRealId && !sending}
                    busy={sending}
                    onEdit={(content) => void editMessage(m.id, content)}
                  />
                )
              })}
              {sending && (
                <div className="flex flex-col gap-2">
                  {(streamingStep || streamingTool) && (
                    <div className="text-xs text-(--c-accent)/80">
                      {streamingStep && <span>Step: {streamingStep}</span>}
                      {streamingStep && streamingTool && (
                        <span className="text-(--c-text-subtle)"> · </span>
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
                    <div className="text-(--c-text-muted) text-sm animate-pulse">
                      Thinking…
                    </div>
                  )}
                </div>
              )}
              {error && <div className="text-(--c-danger-text) text-sm">{error}</div>}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        );
    }

    return (
      <div className="relative h-full flex flex-col items-center">
        <div className="sticky top-0 w-full text-(--c-text-body) px-5 py-2 bg-(--c-surface) z-10 flex items-center gap-3">
          <span className="truncate">{headerTitle}</span>
          {targetId && (
            <CopyCurlButton targetId={targetId} className="ml-auto" />
          )}
        </div>
        {renderBody()}
        <ChatInput />
      </div>
    );
}

export default ChatBox
