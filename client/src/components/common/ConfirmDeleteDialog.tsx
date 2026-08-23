import type { ReactNode } from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog'

interface ConfirmDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: ReactNode
    onConfirm: () => void
    deleting?: boolean
    confirmLabel?: string
}

function ConfirmDeleteDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    deleting = false,
    confirmLabel = 'Delete',
}: ConfirmDeleteDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={deleting}
                        onClick={(e) => { e.preventDefault(); onConfirm() }}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {deleting ? 'Deleting…' : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default ConfirmDeleteDialog
