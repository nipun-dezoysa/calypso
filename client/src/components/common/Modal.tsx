import { useEffect, type ReactNode } from 'react'
import { IoClose } from 'react-icons/io5'
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
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') (onEscape ?? onClose)()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose, onEscape])

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="modal-panel"
                style={{ maxWidth }}
                role="dialog"
                aria-modal="true"
            >
                <div className="modal-header">
                    <div>
                        <p className="modal-title">{title}</p>
                        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                    </div>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <IoClose />
                    </button>
                </div>

                <div className="modal-body">{children}</div>

                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    )
}

export default Modal
