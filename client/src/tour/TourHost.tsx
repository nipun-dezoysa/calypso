import { useEffect, useRef } from 'react'
import { listAIProviders } from '../api/aiProviderApi'
import { useAuthStore } from '../stores/AuthStore'
import { useTourStore } from '../stores/TourStore'
import { runTour, type TourHandle } from './runTour'
import { TOURS } from './tours'

/** Long enough for the sidebar's own fetches to land, so the first step is
 *  not pointing at a spinner. */
const AUTOSTART_DELAY_MS = 900

/** Headless — mounted once, owns the running tour and decides whether a
 *  brand-new user gets offered one. */
function TourHost() {
    const user = useAuthStore((s) => s.user)
    const activeTour = useTourStore((s) => s.activeTour)
    const setUser = useTourStore((s) => s.setUser)
    const endTour = useTourStore((s) => s.endTour)

    const handleRef = useRef<TourHandle | null>(null)

    useEffect(() => {
        setUser(user?.id ?? null)
    }, [user?.id, setUser])

    // Offer the onboarding tour once per user, and only to someone who has
    // not already set the app up — a returning user on a fresh browser should
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
        const definition = TOURS[activeTour]
        const handle = runTour(definition, {
            onEnd: (status, stepId) => {
                handleRef.current = null
                endTour(activeTour, status, stepId)
            },
        })
        handleRef.current = handle
        return () => {
            handleRef.current = null
            handle.stop()
        }
    }, [activeTour, endTour])

    // Signing out mid-tour should not leave an overlay on the login screen.
    useEffect(() => {
        if (user) return
        handleRef.current?.stop()
    }, [user])

    return null
}

export default TourHost
