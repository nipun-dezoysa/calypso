import { driver, type Driver, type DriveStep, type PopoverDOM } from 'driver.js'
import 'driver.js/dist/driver.css'
import './driver-theme.css'
import { isDark } from '../utils/theme'
import { onTourEvent } from './tourEvents'
import type { TourDefinition, TourStep } from './tourTypes'

/** Modals mount a tick after the click that opens them, and some load their
 *  fields over the network first. driver.js watches with a MutationObserver
 *  and resolves the moment the element lands, so this is only the ceiling. */
const ELEMENT_WAIT_MS = 10_000

/** How often a `condition` step re-checks its predicate. */
const CONDITION_POLL_MS = 300

export interface TourHandle {
    stop: () => void
}

export interface RunTourOptions {
    onEnd: (status: 'completed' | 'skipped', stepId: string | null) => void
}

function readVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** In a dark theme the app's own background makes the best scrim. A light
 *  theme needs a genuinely dark wash instead, because tinting white over white
 *  dims nothing. */
function scrim(): { overlayColor: string; overlayOpacity: number } {
    const bg = readVar('--c-bg')
    return isDark(bg || '#09090b')
        ? { overlayColor: bg || '#09090b', overlayOpacity: 0.62 }
        : { overlayColor: '#0b0b0f', overlayOpacity: 0.4 }
}

function settle(): Promise<void> {
    // One macrotask plus a frame: long enough for React to commit whatever
    // `setup` changed, short enough not to feel like a stall.
    return new Promise((resolve) => {
        setTimeout(() => requestAnimationFrame(() => resolve()), 50)
    })
}

export function runTour(def: TourDefinition, options: RunTourOptions): TourHandle {
    let index = 0
    let outcome: 'completed' | 'skipped' = 'skipped'
    let releaseAdvance: (() => void) | null = null
    let ended = false

    function teardownAdvance() {
        releaseAdvance?.()
        releaseAdvance = null
    }

    const driveSteps: DriveStep[] = def.steps.map((step) => {
        const advance = step.advance ?? { on: 'next' }
        // Two kinds of step withhold Next. A click step, because the
        // highlighted element is the only thing on the page still accepting
        // clicks and pressing it is the whole instruction. And a `required`
        // step, because every step after it assumes the thing got done.
        // There is no sense walking someone through attaching a knowledgebase
        // they skipped creating. Both are re-opened by `unlock` below when
        // the work turns out to be already done, and × always closes the tour.
        const gated =
            advance.on === 'click' ||
            (advance.on !== 'next' && advance.required === true)
        const showButtons: DriveStep['popover'] = {
            showButtons: gated
                ? ['previous', 'close']
                : ['next', 'previous', 'close'],
        }
        return {
            element: step.element,
            // Click-advance is handled in armAdvance, not by driver's own
            // `advanceOnClick`: driver ignores clicks that land while the
            // popover is still animating in, and a click on "+ Add" that
            // opens the modal but leaves the tour a step behind is worse
            // than no guidance at all.
            waitForElement: step.waitForElement ?? (step.element ? ELEMENT_WAIT_MS : 0),
            popover: {
                title: step.title,
                description: step.description,
                side: step.side ?? 'right',
                align: step.align ?? 'start',
                ...showButtons,
            },
        }
    })

    const driverObj: Driver = driver({
        steps: driveSteps,
        animate: true,
        duration: 250,
        smoothScroll: true,
        allowClose: true,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: 'calypso-tour',
        showProgress: true,
        progressText: '{{current}} / {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        // Arrow keys would otherwise advance the tour while someone is typing
        // in the very field the step told them to fill in.
        allowKeyboardControl: false,
        // Losing a half-finished tour to a stray click on the dim area is a
        // worse outcome than making them use the × button.
        overlayClickBehavior: () => {},
        ...scrim(),

        onNextClick: () => void goTo(index + 1),
        onPrevClick: () => void goTo(index - 1),
        onDoneClick: () => finish(),

        onHighlighted: () => {
            revealNextIfStranded()
            void unlockIfAlreadyDone(def.steps[index], index)
        },

        // Fires for the × button. destroy() re-enters without this hook.
        onDestroyStarted: () => driverObj.destroy(),
        onDestroyed: () => end(),
    })

    function revealNext() {
        const popover = driverObj.getState('popover') as PopoverDOM | undefined
        if (!popover) return
        popover.nextButton.style.display = 'block'
        popover.footer.style.display = 'flex'
    }

    /** If the element never appeared, driver falls back to a centered popover.
     *  A gated step would then be showing no Next button and nothing to act
     *  on, so put the button back. A broken anchor must not strand anyone. */
    function revealNextIfStranded() {
        if (driverObj.getActiveElement()?.id !== 'driver-dummy-element') return
        revealNext()
    }

    /** A `required` step blocks on work the user may have done on an earlier
     *  run. Replaying the tour on a configured instance would otherwise stop
     *  dead at "create a provider". Ask, and hand Next back if so. */
    async function unlockIfAlreadyDone(step: TourStep | undefined, forIndex: number) {
        const advance = step?.advance
        if (!advance || advance.on === 'next' || advance.on === 'click') return
        if (advance.required !== true) return

        if (advance.on === 'condition' && advance.check()) {
            revealNext()
            return
        }
        if (!step?.satisfied) return
        try {
            const done = await step.satisfied()
            if (done && !ended && index === forIndex) revealNext()
        } catch {
            // Can't tell, so leave the step gated on the event itself.
        }
    }

    /** Armed before the step is highlighted rather than after, so an action
     *  taken during the popover's fade-in still counts. `forIndex` guards
     *  against a watcher outliving its own step. */
    function armAdvance(step: TourStep | undefined, forIndex: number) {
        teardownAdvance()
        const advance = step?.advance
        if (!advance) return

        const fire = () => {
            if (ended || index !== forIndex) return
            void goTo(forIndex + 1)
        }

        if (advance.on === 'click') {
            if (!step?.element) return
            const selector = step.element
            // Capture phase and re-resolved per click: the element may well be
            // re-rendered between arming and the click that matters.
            const handler = (event: Event) => {
                const target = document.querySelector(selector)
                if (target && event.target instanceof Node && target.contains(event.target)) {
                    fire()
                }
            }
            document.addEventListener('click', handler, true)
            releaseAdvance = () => document.removeEventListener('click', handler, true)
            return
        }

        if (advance.on === 'event') {
            releaseAdvance = onTourEvent(advance.name, fire)
            return
        }

        if (advance.on !== 'condition') return

        // Only a change *after* the step opens should advance it. Otherwise a
        // step describing a box the user already filled in flashes past before
        // it can be read.
        if (advance.check()) return
        const timer = window.setInterval(() => {
            if (!advance.check()) return
            window.clearInterval(timer)
            fire()
        }, CONDITION_POLL_MS)
        releaseAdvance = () => window.clearInterval(timer)
    }

    async function goTo(next: number) {
        if (ended) return
        teardownAdvance()
        if (next >= def.steps.length) {
            finish()
            return
        }
        if (next < 0) return

        const step = def.steps[next]
        index = next
        try {
            await step.setup?.()
        } catch {
            // A setup that fails is not worth ending the tour over; the step
            // falls back to a centered card if its element never turns up.
        }
        if (ended) return
        await settle()
        if (ended) return
        armAdvance(step, next)
        driverObj.moveTo(next)
    }

    function finish() {
        outcome = 'completed'
        driverObj.destroy()
    }

    function end() {
        if (ended) return
        ended = true
        teardownAdvance()
        options.onEnd(outcome, def.steps[index]?.id ?? null)
    }

    // Kick off through goTo so the first step gets its setup too.
    void (async () => {
        const first = def.steps[0]
        try {
            await first?.setup?.()
        } catch {
            /* see goTo */
        }
        if (ended) return
        await settle()
        if (ended) return
        armAdvance(first, 0)
        driverObj.drive(0)
    })()

    return {
        stop: () => {
            if (ended) return
            driverObj.destroy()
        },
    }
}
