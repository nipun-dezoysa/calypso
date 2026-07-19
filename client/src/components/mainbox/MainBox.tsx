import type { ReactNode } from "react";
import ChatBox from "./chatbox/ChatBox";
import WorkflowBox from "./workflowBox/WorkflowBox";
import { useMainViewStore, type MainView } from "../../stores/MainViewStore";
import { useWorkflowStore } from "../../stores/WorkflowStore";

interface BoxContext {
  view: MainView;
  selectedWorkflowId: string | null;
}

interface BoxDefinition {
  id: string;
  isActive: (ctx: BoxContext) => boolean;
  render: (ctx: BoxContext) => ReactNode;
}

const BOXES: BoxDefinition[] = [
  {
    id: "workflow-builder",
    isActive: (ctx) =>
      ctx.view === "workflow" && ctx.selectedWorkflowId !== null,
    render: (ctx) => (
      <WorkflowBox
        key={ctx.selectedWorkflowId as string}
        workflowId={ctx.selectedWorkflowId as string}
      />
    ),
  },
  {
    id: "workflow-empty",
    isActive: (ctx) => ctx.view === "workflow",
    render: () => (
      <div className="h-full w-full flex items-center justify-center text-zinc-500 text-sm">
        Select a workflow, or create a new one to start building.
      </div>
    ),
  },
  {
    id: "chat",
    isActive: () => true,
    render: () => <ChatBox />,
  },
];

function MainBox() {
  const view = useMainViewStore((s) => s.view);
  const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId);

  const ctx: BoxContext = { view, selectedWorkflowId };
  const box = BOXES.find((b) => b.isActive(ctx)) ?? BOXES[BOXES.length - 1];

  return <div className="h-full w-full">{box.render(ctx)}</div>;
}

export default MainBox;
