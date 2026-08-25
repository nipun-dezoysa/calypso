import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 'first-run' is the onboarding path; 'workflows' is the opt-in advanced tour. */
export type TourId = 'first-run' | 'workflows'

export interface TourRecord {
    status: 'completed' | 'skipped'
    /** Where they were when they left, so a skip can be resumed. */
    stepId: string | null
    at: number
}

interface TourState {
    activeTour: TourId | null
    /** Set by TourHost — every record is keyed by it so a second login on the
     *  same browser starts fresh instead of inheriting someone else's run. */
    userId: string | null
    records: Record<string, TourRecord>
    /** Users the first-run tour has already been offered to, once, ever. */
    autoStarted: Record<string, true>

    setUser: (userId: string | null) => void
    startTour: (id: TourId) => void
    /** Called by the engine when the tour ends, either way. */
    endTour: (id: TourId, status: TourRecord['status'], stepId: string | null) => void
    recordFor: (id: TourId) => TourRecord | undefined
    markAutoStarted: () => void
    hasAutoStarted: () => boolean
}

function key(userId: string | null, id: TourId): string {
    return `${userId ?? 'anon'}::${id}`
}

export const useTourStore = create<TourState>()(
    persist(
        (set, get) => ({
            activeTour: null,
            userId: null,
            records: {},
            autoStarted: {},

            setUser: (userId) => set({ userId }),

            startTour: (id) => set({ activeTour: id }),

            endTour: (id, status, stepId) =>
                set((s) => ({
                    activeTour: null,
                    records: {
                        ...s.records,
                        [key(s.userId, id)]: { status, stepId, at: Date.now() },
                    },
                })),

            recordFor: (id) => get().records[key(get().userId, id)],

            markAutoStarted: () =>
                set((s) => ({
                    autoStarted: { ...s.autoStarted, [s.userId ?? 'anon']: true },
                })),

            hasAutoStarted: () => Boolean(get().autoStarted[get().userId ?? 'anon']),
        }),
        {
            name: 'calypso-tour',
            // activeTour and userId are session facts — persisting them would
            // relaunch the tour on top of a cold page load.
            partialize: (s) => ({ records: s.records, autoStarted: s.autoStarted }),
        },
    ),
)
