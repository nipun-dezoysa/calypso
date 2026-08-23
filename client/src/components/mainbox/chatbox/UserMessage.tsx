import { useState } from 'react'
import { IoPencilOutline } from 'react-icons/io5'
import type { ChatAttachment } from '../../../api/chatApi'
import AttachmentChip from './AttachmentChip'
import { Button } from '../../ui/button'
import { Textarea } from '../../ui/textarea'

interface Props {
    message?: string
    /** Omitted for the in-flight streaming preview. */
    messageId?: string
    attachments?: ChatAttachment[]
    canEdit?: boolean
    busy?: boolean
    onEdit?: (content: string) => void
}

function UserMessage({ message, messageId, attachments, canEdit, busy, onEdit }: Props) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(message ?? '')
    const hasAttachments = (attachments?.length ?? 0) > 0

    function startEdit() {
        setDraft(message ?? '')
        setEditing(true)
    }

    function save() {
        const trimmed = draft.trim()
        if (!trimmed || trimmed === message) {
            setEditing(false)
            return
        }
        onEdit?.(trimmed)
        setEditing(false)
    }

    if (editing) {
        return (
            <div className="text-(--c-text-body) flex justify-end">
                <div className="bg-(--c-hover) p-2 rounded-md max-w-[75%] w-full flex flex-col gap-2">
                    <Textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                save()
                            } else if (e.key === 'Escape') {
                                setEditing(false)
                            }
                        }}
                        rows={Math.min(8, Math.max(2, draft.split('\n').length))}
                        className="w-full bg-(--c-surface) text-(--c-text) text-sm resize-none border-(--c-border) focus-visible:border-(--c-accent) focus-visible:ring-0"
                    />
                    <div className="flex justify-end gap-2 text-xs">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={save}
                        >
                            Save &amp; submit
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="text-(--c-text-body) flex justify-end group">
            <div className="flex items-start gap-1 max-w-[75%]">
                {messageId && canEdit && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={startEdit}
                        disabled={busy}
                        title="Edit message"
                        aria-label="Edit message"
                        className="mt-2.5 shrink-0 size-6 text-(--c-text-subtle) hover:text-(--c-accent-hi) opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-0"
                    >
                        <IoPencilOutline size={14} />
                    </Button>
                )}
                <div className="bg-(--c-hover) p-2 rounded-md flex flex-col gap-2 min-w-0">
                    {hasAttachments && (
                        <div className="flex flex-wrap gap-2 justify-end">
                            {attachments?.map((a) => (
                                <AttachmentChip key={a.id} attachment={a} />
                            ))}
                        </div>
                    )}
                    {message && <p className="whitespace-pre-wrap">{message}</p>}
                </div>
            </div>
        </div>
    )
}

export default UserMessage
