import { create } from 'zustand'
export type MainView = 'chat' | 'workflow'

interface MainViewState {
    view: MainView
    showChat: () => void
    showWorkflow: () => void
}

export const useMainViewStore = create<MainViewState>((set) => ({
    view: 'chat',
    showChat: () => set({ view: 'chat' }),
    showWorkflow: () => set({ view: 'workflow' }),
}))
