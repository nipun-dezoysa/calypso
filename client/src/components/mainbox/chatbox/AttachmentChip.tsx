import { useEffect, useState } from 'react'
import { IoClose, IoDocumentTextOutline, IoWarningOutline } from 'react-icons/io5'
import { fetchAttachmentBlob, type ChatAttachment } from '../../../api/chatApi'

const thumbnailCache = new Map<string, string>()

function useThumbnail(attachment: ChatAttachment): string | null {
    const isImage = attachment.kind === 'image'
    const [url, setUrl] = useState<string | null>(
        () => thumbnailCache.get(attachment.id) ?? null,
    )

    useEffect(() => {
        if (!isImage || url) return
        let cancelled = false
        fetchAttachmentBlob(attachment.id)
            .then((blob) => {
                if (cancelled) return
                const objectUrl = URL.createObjectURL(blob)
                thumbnailCache.set(attachment.id, objectUrl)
                setUrl(objectUrl)
            })
            .catch(() => {
                // Fall through to the generic icon.
            })
        return () => {
            cancelled = true
        }
    }, [attachment.id, isImage, url])

    return url
}

function formatSize(bytes: number | null): string {
    if (bytes === null) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function subtitle(attachment: ChatAttachment): string {
    if (attachment.status === 'failed') {
        return attachment.error_message ?? 'Could not be read'
    }
    const size = formatSize(attachment.size_bytes)
    if (attachment.kind === 'image' && !attachment.has_text) {
        return size ? `${size} · image only` : 'image only'
    }
    return size
}

interface Props {
    attachment: ChatAttachment
    onRemove?: (attachmentId: string) => void
}

function AttachmentChip({ attachment, onRemove }: Props) {
    const thumbnail = useThumbnail(attachment)
    const failed = attachment.status === 'failed'

    return (
        <div
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 max-w-56 ${
                failed
                    ? 'border-red-800/60 bg-red-950/30'
                    : 'border-zinc-700 bg-zinc-900'
            }`}
            title={failed ? (attachment.error_message ?? undefined) : attachment.filename}
        >
            <div className='shrink-0 w-8 h-8 rounded overflow-hidden bg-zinc-800 flex items-center justify-center text-zinc-400'>
                {thumbnail ? (
                    <img src={thumbnail} alt={attachment.filename} className='w-full h-full object-cover' />
                ) : failed ? (
                    <IoWarningOutline className='text-red-400' />
                ) : (
                    <IoDocumentTextOutline />
                )}
            </div>

            <div className='min-w-0 flex-1'>
                <div className='truncate text-xs text-zinc-300'>{attachment.filename}</div>
                <div className={`truncate text-[11px] ${failed ? 'text-red-400' : 'text-zinc-500'}`}>
                    {subtitle(attachment)}
                </div>
            </div>

            {onRemove && (
                <button
                    type='button'
                    onClick={() => onRemove(attachment.id)}
                    className='shrink-0 text-zinc-500 hover:text-zinc-200 cursor-pointer'
                    aria-label={`Remove ${attachment.filename}`}
                >
                    <IoClose />
                </button>
            )}
        </div>
    )
}

export default AttachmentChip
