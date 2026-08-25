import { useEffect, useRef, useState } from 'react'
import { listAIProviders } from '../api/aiProviderApi'
import { useAuthStore } from '../stores/AuthStore'
import { useTourStore, type TourId } from '../stores/TourStore'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { runTour, type TourHandle } from './runTour'
import { TOURS } from './tours'

/** Long enough for the sidebar's own fetches to land, so the first step is
 *  not pointing at a spinner. */
const AUTOSTART_DELAY_MS = 900

/** Let the finished tour's overlay fade out before the question lands on top
 *  of it, and let Radix release the dialog's pointer lock before the next
 *  tour starts driving the page underneath. */
const HANDOFF_DELAY_MS = 400

/** Headless. Mounted once, owns the running tour and decides whether a
 *  brand-new user gets offered one. */
function TourHost() {
    const user = useAuthStore((s) => s.user)
    const activeTour = useTourStore((s) => s.activeTour)
    const setUser = useTourStore((s) => s.setUser)
    const endTour = useTourStore((s) => s.endTour)

    const startTour = useTourStore((s) => s.startTour)
    const recordFor = useTourStore((s) => s.recordFor)

    const [offeringWorkflows, setOfferingWorkflows] = useState(false)
    const runningRef = useRef<{ id: TourId; handle: TourHandle } | null>(null)

    useEffect(() => {
        setUser(user?.id ?? null)
    }, [user?.id, setUser])

    // Offer the onboarding tour once per user, and only to someone who has
    // not already set the app up. A returning user on a fresh browser should
    // not be walked through building a provider they already have.
    useEffect(() => {
        if (!user) return
        const store = useTourStore.getState()
        if (store.hasAutoStarted() || store.recordFor('first-run')) return

        let cancelled = false
        const timer = window.setTimeout(async () => {
            try {
                const providers = await listAIProviders({ limit: 1 })
                if (cancelled) return
                useTourStore.getState().markAutoStarted()
                if (providers.length === 0) useTourStore.getState().startTour('first-run')
            } catch {
                // Can't tell whether they're set up; leave the tour to the
                // Settings entry rather than guessing wrong.
            }
        }, AUTOSTART_DELAY_MS)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [user])

    useEffect(() => {
        if (!activeTour) return
        // StrictMode mounts, tears down and mounts again. Starting a second
        // run would stack two overlays on the page, so recognise the tour
        // already driving and leave it alone.
        if (runningRef.current?.id === activeTour) return
        // Switching straight from one tour to another would otherwise strand
        // the first one's overlay on the page.
        runningRef.current?.handle.stop()

        const definition = TOURS[activeTour]
        const handle = runTour(definition, {
            onEnd: (status, stepId) => {
                runningRef.current = null
                endTour(activeTour, status, stepId)
                // Finishing onboarding is the moment someone is most likely to
                // want the next one. Only after finishing, though: asking
                // someone who just closed a tour to start another reads as
                // nagging. And only once, since a tour they have already been
                // through has a record.
                if (
                    activeTour === 'first-run' &&
                    status === 'completed' &&
                    !recordFor('workflows')
                ) {
                    window.setTimeout(() => setOfferingWorkflows(true), HANDOFF_DELAY_MS)
                }
            },
        })
        runningRef.current = { id: activeTour, handle }
        // No teardown here on purpose. Under StrictMode this cleanup runs
        // between the two mounts, and stopping the tour there would kill the
        // run the second mount then declines to restart. A tour ends when it
        // ends (which clears the ref) or when this component unmounts, below.
    }, [activeTour, endTour, recordFor])

    // Signing out swaps the whole app for the login screen, taking this
    // component with it, so unmount is the only hook that actually fires.
    // Without this the overlay outlives the session it belonged to.
    useEffect(
        () => () => {
            runningRef.current?.handle.stop()
            runningRef.current = null
        },
        [],
    )

    function acceptWorkflowsTour() {
        setOfferingWorkflows(false)
        // The workflow tour points at the sidebar and the canvas, both of them
        // behind this dialog while Radix is still animating it out.
        window.setTimeout(() => startTour('workflows'), HANDOFF_DELAY_MS)
    }

    return (
        <AlertDialog open={offeringWorkflows} onOpenChange={setOfferingWorkflows}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Take the workflows tour?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have the basics. The last piece is workflows: several agents
                        chained into a branching graph, built on a canvas or drafted for
                        you by the AI Designer. It takes about two minutes.
                        <br />
                        <br />
                        Either way you can start it later from Settings &rarr; Product Tour.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Not now</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            acceptWorkflowsTour()
                        }}
                    >
                        Show me
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default TourHost
