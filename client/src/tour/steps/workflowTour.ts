import { useMainViewStore } from '../../stores/MainViewStore'
import { useWorkflowStore } from '../../stores/WorkflowStore'
import type { TourDefinition } from '../tourTypes'
import { openSection } from './shared'

/** The advanced tour, offered from Settings once the first-run one is done.
 *  Two halves: building a graph by hand, then handing the same job to the
 *  Designer. The hand-built half comes first on purpose — the Designer's
 *  output is only reviewable if you know what a node and a branch are. */
export const workflowTour: TourDefinition = {
    id: 'workflows',
    steps: [
        {
            id: 'wf-welcome',
            title: 'Workflows',
            description:
                'One agent answers one way. A workflow chains several together — classify first, then branch, then answer, then rewrite — and each node can be a different model with its own instructions, documents and tools.<br><br>You will build one by hand, then have the AI Designer draft one for you.',
            align: 'center',
        },
        {
            id: 'wf-nav',
            element: '[data-tour="nav-workflows"]',
            title: 'Open Workflows',
            description: '<strong>Click the network icon.</strong>',
            side: 'right',
            advance: { on: 'click' },
        },
        {
            id: 'wf-create',
            element: '[data-tour="workflow-add"]',
            title: 'Create a workflow',
            description:
                '<strong>+ New</strong> makes an empty one and drops you straight onto its canvas — or click one you already have. Rename, duplicate and delete live in the ⋮ menu on each row.',
            side: 'right',
            setup: () => openSection('workflows'),
            advance: {
                on: 'condition',
                required: true,
                check: () =>
                    useMainViewStore.getState().view === 'workflow' &&
                    useWorkflowStore.getState().selectedWorkflowId !== null,
            },
        },
        {
            id: 'wf-toolbar',
            element: '[data-tour="wf-toolbar"]',
            title: 'The canvas toolbar',
            description:
                'Name on the left, then everything you can do to the graph. Nothing here touches the server until you press Save.',
            side: 'bottom',
        },
        {
            id: 'wf-add-agent',
            element: '[data-tour="wf-add-agent-node"]',
            title: 'Add an agent node',
            description:
                'A step that calls a model. <strong>Click it a couple of times</strong> — a workflow needs at least two nodes to be worth chaining.',
            side: 'bottom',
            advance: { on: 'click' },
        },
        {
            id: 'wf-select-node',
            element: '[data-tour="wf-canvas"]',
            title: 'Select a node',
            description:
                'Add a second one if you like, then <strong>click a node</strong> to select it. Its settings open on the right.',
            side: 'top',
            align: 'center',
            advance: {
                on: 'condition',
                required: true,
                check: () => document.querySelector('[data-tour="wf-node-panel"]') !== null,
            },
        },
        {
            id: 'wf-node-config',
            element: '[data-tour="wf-node-panel"]',
            title: 'Configure the selected node',
            description:
                'Each node picks its own model, instructions, knowledgebases and MCP servers — or borrows them wholesale from an agent you already built.',
            side: 'left',
        },
        {
            id: 'wf-start',
            element: '[data-tour="wf-node-panel"]',
            title: 'Mark where it begins',
            description:
                '<strong>Set as start</strong> tells the workflow which node receives the incoming question. Exactly one node carries the flag, and a workflow will not save without it.',
            side: 'left',
        },
        {
            id: 'wf-connect',
            element: '[data-tour="wf-canvas"]',
            title: 'Wire the nodes together',
            description:
                '<strong>Drag from the handle on one node to another</strong> to connect them — output flows along the arrow. Click an edge and press Delete to remove it.',
            side: 'top',
            align: 'center',
        },
        {
            id: 'wf-condition',
            element: '[data-tour="wf-add-condition-node"]',
            title: 'Branch on the answer',
            description:
                'A condition node splits the path. You give each branch a plain-English description — <code>the user is asking about billing</code> — and the model routes to whichever one matches, with one outgoing edge per branch.',
            side: 'bottom',
        },
        {
            id: 'wf-save',
            element: '[data-tour="wf-save"]',
            title: 'Save the graph',
            description:
                'Or <code>Ctrl+S</code>. The save is validated: a missing start node, an unreachable step or a branch with nowhere to go comes back as an error instead of silently half-working.',
            side: 'bottom',
            advance: { on: 'event', name: 'workflow.saved' },
        },

        // ── The Designer ───────────────────────────────────────────────────
        {
            id: 'wf-designer-open',
            element: '[data-tour="wf-designer"]',
            title: 'Or describe it instead',
            description:
                'The Designer builds the graph from a sentence. <strong>Click it</strong> to open the panel.',
            side: 'bottom',
            advance: { on: 'click' },
        },
        {
            id: 'wf-designer-intro',
            element: '[data-tour="wf-designer-panel"]',
            title: 'What the Designer sees',
            description:
                'It gets the canvas exactly as it stands, half-finished and all. So it works on an empty workflow and equally on the one you just built — asking it to add a step or fix a broken branch is the normal way to use it.',
            side: 'left',
        },
        {
            id: 'wf-designer-model',
            element: '[data-tour="wf-designer-model"]',
            title: 'The model doing the designing',
            description:
                'This is the model that <em>writes</em> the workflow, not one the workflow runs on. Give it your strongest — laying out a graph is harder than answering with one. Your choice is remembered.',
            side: 'top',
        },
        {
            id: 'wf-designer-input',
            element: '[data-tour="wf-designer-input"]',
            title: 'Describe what you want',
            description:
                '<strong>Type a request and send.</strong> Try the examples in the panel, or ask for a change to what is already there: <em>add a step at the end that shortens the answer</em>. On a local model this can take a few minutes.',
            side: 'top',
        },
        {
            id: 'wf-designer-apply',
            element: '[data-tour="wf-canvas"]',
            title: 'It drafts onto the canvas',
            description:
                'The result is drawn as a real graph you can inspect and edit by hand. <strong>Nothing is saved</strong> — the reply flags any fixes it had to make, <strong>Undo design</strong> puts the canvas back, and Save is still yours to press.',
            side: 'top',
            align: 'center',
        },
        {
            id: 'wf-chat',
            element: '[data-tour="wf-chat-toggle"]',
            title: 'Test it right here',
            description:
                'Opens a chat against this workflow beside the canvas. As it runs you will see which node is answering, so a wrong turn is obvious.',
            side: 'top',
            align: 'center',
        },
        {
            id: 'wf-in-chat',
            element: '[data-tour="nav-conversations"]',
            title: 'Saved workflows chat like agents',
            description:
                'They appear under <strong>Workflows</strong> in the Conversations sidebar, keep their own threads, and answer the same public API endpoint an agent does.',
            side: 'right',
        },
        {
            id: 'wf-done',
            title: 'Done',
            description:
                'Build by hand, or describe and refine — most workflows end up as some of both.<br><br>Both tours can be replayed any time from <strong>Settings → Product Tour</strong>.',
            align: 'center',
        },
    ],
}
