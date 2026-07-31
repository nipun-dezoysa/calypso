import { create } from "zustand";
import type { SidebarSection } from "../types/sidebar";

interface SideBarState {
    activeSection: SidebarSection;
    setActiveSection: (section: SidebarSection) => void;
    isCollapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    toggleCollapsed: () => void;
}

export const useSideBarStore = create<SideBarState>((set) => ({
    activeSection: 'conversations',
    setActiveSection: (section) => set({ activeSection: section }),
    isCollapsed: false,
    setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
    toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
}));
