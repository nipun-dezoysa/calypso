import { useState } from 'react'
import { IoPencilOutline } from 'react-icons/io5'
import type { ChatAttachment } from '../../../api/chatApi'
import AttachmentChip from './AttachmentChip'

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
                    <textarea
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
                        className="w-full bg-(--c-surface) text-(--c-text) rounded p-2 text-sm resize-none outline-none border border-(--c-border) focus:border-(--c-accent)"
                    />
                    <div className="flex justify-end gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="px-2 py-1 rounded text-(--c-text-dim) hover:text-(--c-text)"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            className="px-2 py-1 rounded bg-(--c-accent) text-(--c-bg) hover:bg-(--c-accent)"
                        >
                            Save &amp; submit
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="text-(--c-text-body) flex justify-end group">
            <div className="flex items-start gap-1 max-w-[75%]">
                {messageId && canEdit && (
                    <button
                        type="button"
                        onClick={startEdit}
                        disabled={busy}
                        title="Edit message"
                        aria-label="Edit message"
                        className="mt-2.5 shrink-0 text-(--c-text-subtle) hover:text-(--c-accent-hi) p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-0"
                    >
                        <IoPencilOutline size={14} />
                    </button>
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
