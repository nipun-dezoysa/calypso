import { type ReactNode } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '../ui/dialog'
import './ui.css'

export interface ModalProps {
    title: ReactNode
    subtitle?: ReactNode
    onClose: () => void
    onEscape?: () => void
    children: ReactNode
    footer?: ReactNode
    maxWidth?: number
}

function Modal({
    title,
    subtitle,
    onClose,
    onEscape,
    children,
    footer,
    maxWidth = 520,
}: ModalProps) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent
                className="p-0 gap-0 flex flex-col overflow-hidden rounded-[var(--radius-lg)]"
                style={{ width: maxWidth, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)' }}
                onEscapeKeyDown={(e) => {
                    if (onEscape) {
                        e.preventDefault()
                        onEscape()
                    }
                }}
            >
                <div className="modal-header">
                    <div>
                        <DialogTitle asChild>
                            <p className="modal-title">{title}</p>
                        </DialogTitle>
                        {subtitle ? (
                            <DialogDescription asChild>
                                <p className="modal-subtitle">{subtitle}</p>
                            </DialogDescription>
                        ) : (
                            <DialogDescription className="sr-only">{title}</DialogDescription>
                        )}
                    </div>
                </div>

                <div className="modal-body">{children}</div>

                {footer && <div className="modal-footer">{footer}</div>}
            </DialogContent>
        </Dialog>
    )
}

export default Modal
