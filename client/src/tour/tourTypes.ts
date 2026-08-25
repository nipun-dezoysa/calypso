import type { Alignment, Side } from 'driver.js'
import type { TourEventName } from './tourEvents'
import type { TourId } from '../stores/TourStore'

/** How a step decides it is finished.
 *
 *  `required` on an event/condition step hides Next entirely: the tour will
 *  not move on until the thing has actually happened. Use it wherever a later
 *  step would be nonsense otherwise, such as walking someone through attaching a
 *  knowledgebase they never created, or pointing at a sidebar that is still
 *  behind an open modal. The × button always remains, so this gates the tour
 *  rather than trapping the user in it. */
export type TourAdvance =
    /** The default: the Next button, nothing else. */
    | { on: 'next' }
    /** The user clicks the highlighted element itself. Next is hidden, because
     *  the highlight is the only interactive thing on screen anyway. */
    | { on: 'click' }
    /** Something happened elsewhere in the app (a provider got created). */
    | { on: 'event'; name: TourEventName; required?: boolean }
    /** Polled store predicate, for state no event covers. */
    | { on: 'condition'; check: () => boolean; required?: boolean }

export interface TourStep {
    id: string
    /** CSS selector. Omit for a centered card with no highlight. */
    element?: string
    title: string
    /** Rendered as HTML by driver.js, so inline markup is fine and expected. */
    description: string
    side?: Side
    align?: Alignment
    /** Brings the app to the state where `element` can exist: switches the
     *  sidebar section, expands the rail, opens the chat view. Runs before
     *  driver.js goes looking for the element. */
    setup?: () => void | Promise<void>
    advance?: TourAdvance
    /** Only meaningful alongside `advance.required`, which hides Next until
     *  the step is done. Answers "has this already been done on a previous
     *  run?", so replaying a tour on a configured instance is not a trap. */
    satisfied?: () => boolean | Promise<boolean>
    /** Override the default grace period for a late-mounting element (modals). */
    waitForElement?: number
}

export interface TourDefinition {
    id: TourId
    steps: TourStep[]
}
