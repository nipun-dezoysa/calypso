import type { ChatAttachment } from '../../../api/chatApi'
import AttachmentChip from './AttachmentChip'

interface Props {
    message?: string
    attachments?: ChatAttachment[]
}

function UserMessage({ message, attachments }: Props) {
    const hasAttachments = (attachments?.length ?? 0) > 0

    return (
        <div className="text-zinc-300 flex justify-end">
            <div className="bg-zinc-800 p-2 rounded-md max-w-[75%] flex flex-col gap-2">
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
    )
}

export default UserMessage
