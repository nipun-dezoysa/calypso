import ChatBox from "./chatbox/ChatBox";
import WorkflowBox from "./workflowBox/WorkflowBox";
import { useSideBarStore } from "../../stores/SideBarStore";
import { useWorkflowStore } from "../../stores/WorkflowStore";

function MainBox() {
  const activeSection = useSideBarStore((s) => s.activeSection);
  const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId);

  if (activeSection === "workflows") {
    return (
      <div className="h-full w-full">
        {selectedWorkflowId ? (
          <WorkflowBox key={selectedWorkflowId} workflowId={selectedWorkflowId} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-zinc-500 text-sm">
            Select a workflow, or create a new one to start building.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ChatBox />
    </div>
  );
}

export default MainBox;
