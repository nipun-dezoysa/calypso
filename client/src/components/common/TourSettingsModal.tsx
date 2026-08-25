import { IoPlayOutline, IoRefreshOutline } from 'react-icons/io5'
import Modal from './Modal'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { useTourStore, type TourId } from '../../stores/TourStore'
import { TOURS } from '../../tour/tours'
import './ui.css'

interface TourEntry {
    id: TourId
    name: string
    blurb: string
}

const ENTRIES: TourEntry[] = [
    {
        id: 'first-run',
        name: 'Getting started',
        blurb:
            'Connect a model provider, build an agent, chat with it, then give it a knowledgebase and MCP tools.',
    },
    {
        id: 'workflows',
        name: 'Workflows & Designer',
        blurb:
            'Chain agents into a branching graph on the canvas, then have the AI Designer draft one from a description.',
    },
]

interface TourSettingsModalProps {
    onClose: () => void
}

function TourSettingsModal({ onClose }: TourSettingsModalProps) {
    // Subscribed to, not read directly: it is what makes the status badges
    // repaint after a tour ends.
    useTourStore((s) => s.records)
    const recordFor = useTourStore((s) => s.recordFor)
    const startTour = useTourStore((s) => s.startTour)

    function launch(id: TourId) {
        // The tour points at the sidebar and the canvas, both of which are
        // behind this dialog, so get out of its way first.
        onClose()
        startTour(id)
    }

    function status(id: TourId) {
        const record = recordFor(id)
        if (!record) return { label: 'Not started', variant: 'secondary' as const }
        if (record.status === 'completed') {
            return { label: 'Completed', variant: 'success' as const }
        }
        const step = record.stepId
            ? TOURS[id].steps.findIndex((s) => s.id === record.stepId) + 1
            : 0
        return {
            label: step > 0 ? `Left at step ${step}` : 'Skipped',
            variant: 'secondary' as const,
        }
    }

    return (
        <Modal
            title="Product Tour"
            subtitle="Guided walkthroughs of what Calypso can do"
            onClose={onClose}
            footer={
                <button className="btn btn--cancel" onClick={onClose} type="button">
                    Close
                </button>
            }
        >
            <div className="flex flex-col gap-3">
                {ENTRIES.map((entry) => {
                    const state = status(entry.id)
                    const started = Boolean(recordFor(entry.id))
                    return (
                        <div
                            key={entry.id}
                            className="flex flex-col gap-2 rounded-(--radius) border border-(--c-border) p-3"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-(--c-text-strong)">{entry.name}</span>
                                <Badge variant={state.variant} className="text-[10px] px-1.5 py-0">
                                    {state.label}
                                </Badge>
                            </div>
                            <p className="text-xs text-(--c-text-muted) leading-relaxed">
                                {entry.blurb}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="self-start text-xs"
                                onClick={() => launch(entry.id)}
                            >
                                {started ? <IoRefreshOutline /> : <IoPlayOutline />}
                                {started ? 'Replay' : 'Start'}
                            </Button>
                        </div>
                    )
                })}
            </div>

            <p className="text-[11px] text-(--c-text-subtle) leading-relaxed pt-3">
                A tour drives the real app, so anything you create while following one is
                yours to keep.
            </p>
        </Modal>
    )
}

export default TourSettingsModal
