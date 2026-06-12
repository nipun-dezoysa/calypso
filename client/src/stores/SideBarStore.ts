import { create } from "zustand";
import type { SidebarSection } from "../types/sidebar";

interface SideBarState {
    activeSection: SidebarSection;
    setActiveSection: (section: SidebarSection) => void;
}

export const useSideBarStore = create<SideBarState>((set) => ({
    activeSection: 'conversations',
    setActiveSection: (section) => set({ activeSection: section }),
}));
