import { create } from 'zustand'

interface WorkflowState {
    selectedWorkflowId: string | null
    selectWorkflow: (id: string | null) => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
    selectedWorkflowId: null,
    selectWorkflow: (id) => set({ selectedWorkflowId: id }),
}))
