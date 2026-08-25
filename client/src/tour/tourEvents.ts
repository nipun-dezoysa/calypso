// A tiny pub/sub the tour listens on. Most of what a tour step waits for,
// say "the provider was actually created", lives in a section component's local
// state, out of reach of any store. Rather than lift that state or poll the
// API, the existing success handlers call notifyTour() with one line.

export type TourEventName =
    | 'provider.created'
    | 'agent.created'
    | 'collection.created'
    | 'document.uploaded'
    | 'mcp.created'
    | 'workflow.created'
    | 'workflow.saved'
    | 'designer.applied'

type Listener = () => void

const listeners = new Map<TourEventName, Set<Listener>>()

export function notifyTour(name: TourEventName): void {
    listeners.get(name)?.forEach((fn) => fn())
}

/** Subscribe until the returned function is called. */
export function onTourEvent(name: TourEventName, fn: Listener): () => void {
    const set = listeners.get(name) ?? new Set<Listener>()
    set.add(fn)
    listeners.set(name, set)
    return () => {
        set.delete(fn)
    }
}
