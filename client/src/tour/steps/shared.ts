import { useSideBarStore } from '../../stores/SideBarStore'
import { useMainViewStore } from '../../stores/MainViewStore'
import type { SidebarSection } from '../../types/sidebar'

/** Put the sidebar on `section` and make sure it is actually visible — a
 *  collapsed rail hides every anchor the section owns. */
export function openSection(section: SidebarSection): void {
    const sidebar = useSideBarStore.getState()
    sidebar.setCollapsed(false)
    sidebar.setActiveSection(section)
}

export function openChatView(): void {
    useMainViewStore.getState().showChat()
}

/** True when no modal is covering the app. Steps that point at the sidebar or
 *  the composer gate on this: a dialog left open hides the very thing the
 *  popover is describing. */
export function noModalOpen(): boolean {
    return document.querySelector('[data-slot="dialog-content"]') === null
}

/** The anchor for any step that needs the whole of an open modal to stay
 *  usable. driver.js makes everything but the highlighted element inert, so a
 *  step that highlights one field leaves the modal's own Create button dead. */
export const DIALOG = '[data-slot="dialog-content"]'
