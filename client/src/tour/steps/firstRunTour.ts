import { listAgents } from '../../api/agentApi'
import { listAIProviders } from '../../api/aiProviderApi'
import { listCollections } from '../../api/kbApi'
import { listMcpServers } from '../../api/mcpApi'
import { useChatStore } from '../../stores/ChatStore'
import type { TourDefinition } from '../tourTypes'
import { DIALOG, noModalOpen, openChatView, openSection } from './shared'

/** The onboarding path, in dependency order: a provider makes an agent
 *  possible, an agent makes a chat possible, and everything after that hangs
 *  off the agent. Workflows are deliberately absent; they live in their own
 *  tour, offered from Settings once this one is done. */
export const firstRunTour: TourDefinition = {
    id: 'first-run',
    steps: [
        {
            id: 'welcome',
            title: 'Welcome to Calypso',
            description:
                'Calypso runs AI agents on models you own, hosted or local. This tour walks the whole setup: connect a model, build an agent, chat with it, then give it documents and tools.<br><br>It takes about three minutes, and you can leave any time with the × button.',
            align: 'center',
        },

        // ── Chapter 1 · A model to think with ──────────────────────────────
        {
            id: 'nav-models',
            element: '[data-tour="nav-models"]',
            title: 'Start with a model provider',
            description:
                'Nothing in Calypso can run without a model behind it, so this comes first. <strong>Click the brain icon</strong> to open AI Models.',
            side: 'right',
            setup: () => openSection('conversations'),
            advance: { on: 'click' },
        },
        {
            id: 'provider-add',
            element: '[data-tour="provider-add"]',
            title: 'Add your first provider',
            description:
                'A provider is one place models come from: OpenAI, Anthropic, an Ollama instance on your own machine. <strong>Click + Add.</strong>',
            side: 'right',
            setup: () => openSection('models'),
            advance: { on: 'click' },
        },
        {
            id: 'provider-form',
            element: DIALOG,
            title: 'Fill in the provider',
            description:
                'Pick one of the presets and the URL and model names fill themselves in, or type your own name for anything else.<br><br>List the models you want available and the size of their context window. Hosted providers need an <strong>API key</strong>; something local like Ollama needs a <strong>base URL</strong> instead and no key at all.',
            side: 'left',
        },
        {
            id: 'provider-submit',
            element: DIALOG,
            title: 'Save the provider',
            description:
                'Press <strong>Add Provider</strong>. Every model you listed becomes selectable across the app, and the rest of this tour needs one, so it waits here.',
            side: 'left',
            advance: { on: 'event', name: 'provider.created', required: true },
            satisfied: async () => (await listAIProviders({ limit: 1 })).length > 0,
        },

        // ── Chapter 2 · An agent ───────────────────────────────────────────
        {
            id: 'nav-agents',
            element: '[data-tour="nav-conversations"]',
            title: 'Now build an agent',
            description:
                'An agent is a model plus a personality, a set of documents and a set of tools. <strong>Click the chat icon.</strong>',
            side: 'right',
            setup: () => openSection('models'),
            advance: { on: 'click' },
        },
        {
            id: 'agent-add',
            element: '[data-tour="agent-add"]',
            title: 'Create an agent',
            description: '<strong>Click + New</strong> under Agents.',
            side: 'right',
            setup: () => openSection('conversations'),
            advance: { on: 'click' },
        },
        {
            id: 'agent-name',
            element: '#af-name',
            title: 'Name it',
            description:
                'Something you will recognise in a list later: <code>Support Bot</code>, <code>Research Assistant</code>.',
            side: 'bottom',
        },
        {
            id: 'agent-model',
            element: '#af-model',
            title: 'The model you just added',
            description:
                'Every model from the provider you set up in the last chapter shows up here, grouped by provider. Pick one.',
            side: 'bottom',
        },
        {
            id: 'agent-instructions',
            element: '#af-instructions',
            title: 'System instructions',
            description:
                'The standing brief the agent gets on every single message: its job, its tone, what it must never do. This is where most of an agent\'s behaviour is decided.',
            side: 'top',
        },
        {
            id: 'agent-creativity',
            element: '#af-creativity',
            title: 'Creativity',
            description:
                'Low keeps answers tight and repeatable, which is what you want for factual work. High loosens it up for brainstorming.',
            side: 'top',
        },
        {
            id: 'agent-submit',
            element: DIALOG,
            title: 'Create the agent',
            description:
                'Press <strong>Add Agent</strong>. It appears in the sidebar, ready to talk to.',
            side: 'left',
            advance: { on: 'event', name: 'agent.created', required: true },
            satisfied: async () => (await listAgents({ limit: 1 })).length > 0,
        },

        // ── Chapter 3 · Talk to it ─────────────────────────────────────────
        {
            id: 'agent-list',
            element: '[data-tour="agent-list"]',
            title: 'Your agents live here',
            description:
                '<strong>Click an agent</strong> to make it the one you are chatting with. The ⋮ menu on each row edits or deletes it.',
            side: 'right',
            setup: () => openSection('conversations'),
            advance: {
                on: 'condition',
                check: () => useChatStore.getState().targetType === 'agent',
            },
        },
        {
            id: 'chat-agent-select',
            element: '[data-tour="chat-agent-select"]',
            title: 'The active agent',
            description:
                'Whoever is answering right now. Switch agents from here without leaving the conversation.',
            side: 'top',
            setup: openChatView,
        },
        {
            id: 'chat-input',
            element: '[data-tour="chat-input"]',
            title: 'Ask it something',
            description:
                '<strong>Type a message and press Enter.</strong> The tour moves on as soon as it sends, so there is no need to wait for the answer, which can take a few minutes on a local model.',
            side: 'top',
            setup: openChatView,
            advance: {
                on: 'condition',
                check: () => useChatStore.getState().messages.length > 0,
            },
        },
        {
            id: 'chat-threads',
            element: '[data-tour="chat-threads"]',
            title: 'Every conversation is kept',
            description:
                'Past chats with the selected agent collect here. <strong>+ New</strong> starts a fresh one with no history carried over.',
            side: 'right',
        },

        // ── Chapter 4 · Documents ──────────────────────────────────────────
        {
            id: 'nav-kb',
            element: '[data-tour="nav-knowledgebases"]',
            title: 'Give it something to read',
            description:
                'A knowledgebase is a pile of documents your agent can search before answering. <strong>Click the library icon.</strong>',
            side: 'right',
            advance: { on: 'click' },
        },
        {
            id: 'kb-add',
            element: '[data-tour="kb-add"]',
            title: 'Create a knowledgebase',
            description:
                'Group documents by subject rather than dumping everything in one place. An agent searches whichever ones you attach to it. <strong>Click + New.</strong>',
            side: 'right',
            setup: () => openSection('knowledgebases'),
            advance: { on: 'click' },
        },
        {
            id: 'kb-name',
            element: DIALOG,
            title: 'Name it, then create it',
            description:
                'The description is only for you; it shows on hover in the sidebar. <strong>Press Create</strong> to carry on; the steps after this one need a knowledgebase to exist.',
            side: 'left',
            advance: { on: 'event', name: 'collection.created', required: true },
            satisfied: async () => (await listCollections({ limit: 1 })).length > 0,
        },
        {
            id: 'kb-open',
            element: '[data-tour="kb-list"]',
            title: 'Open it to add files',
            description: '<strong>Click the knowledgebase you just made.</strong>',
            side: 'right',
            setup: () => openSection('knowledgebases'),
            advance: { on: 'click' },
        },
        {
            id: 'kb-upload',
            element: DIALOG,
            title: 'Upload documents',
            description:
                '<strong>Press Upload</strong> and pick a PDF, TXT or Markdown file. Files are chunked and embedded in the background, and the badge on each row turns <strong>Ready</strong> when it can be searched.',
            side: 'left',
            advance: { on: 'event', name: 'document.uploaded', required: true },
        },
        {
            id: 'kb-close',
            element: DIALOG,
            title: 'Close the knowledgebase',
            description:
                'Embedding carries on in the background, so there is nothing to wait for. <strong>Close this dialog</strong>. The next step is back in the chat window, behind it.',
            side: 'left',
            advance: { on: 'condition', check: noModalOpen, required: true },
        },
        {
            id: 'kb-attach',
            element: '[data-tour="chat-kb-select"]',
            title: 'Attach it to the agent',
            description:
                'This is the step that makes the documents matter. <strong>Tick your knowledgebase here</strong> and the agent searches it before every answer. It saves to the agent immediately.',
            side: 'top',
            setup: openChatView,
            advance: {
                on: 'condition',
                required: true,
                check: () =>
                    (useChatStore.getState().selectedAgent?.collections?.length ?? 0) > 0,
            },
        },

        // ── Chapter 5 · Tools ──────────────────────────────────────────────
        {
            id: 'nav-mcp',
            element: '[data-tour="nav-mcps"]',
            title: 'Give it tools',
            description:
                'MCP servers let an agent do things rather than just answer: read a database, hit an API, touch the filesystem. <strong>Click the puzzle icon.</strong>',
            side: 'right',
            advance: { on: 'click' },
        },
        {
            id: 'mcp-add',
            element: '[data-tour="mcp-add"]',
            title: 'Connect a server',
            description: '<strong>Click + Add</strong> to register one.',
            side: 'right',
            setup: () => openSection('mcps'),
            advance: { on: 'click' },
        },
        {
            id: 'mcp-form',
            element: DIALOG,
            title: 'Describe the server',
            description:
                'Pick <code>stdio</code> for a local command, or HTTP/SSE for one already running somewhere. Then save it.',
            side: 'left',
            advance: { on: 'event', name: 'mcp.created', required: true },
            satisfied: async () => (await listMcpServers({ limit: 1 })).length > 0,
        },
        {
            id: 'mcp-attach',
            element: '[data-tour="chat-mcp-select"]',
            title: 'Attach tools to the agent',
            description:
                'Same idea as knowledgebases: tick the servers this agent may use. While it is working you will see <em>Running …</em> above the reply as each tool fires.',
            side: 'top',
            setup: openChatView,
        },

        // ── Chapter 6 · The rest ───────────────────────────────────────────
        {
            id: 'chat-attach',
            element: '[data-tour="chat-attach"]',
            title: 'One-off files',
            description:
                'For a document that belongs to a single question rather than the whole agent, attach it to the message, or just drop it on the composer. PDFs, Word files, text and images.',
            side: 'top',
        },
        {
            id: 'chat-curl',
            element: '[data-tour="chat-curl"]',
            title: 'Every agent is an API',
            description:
                'Copies a ready-to-run <code>curl</code> against this agent\'s public endpoint, so anything you build can call it the same way this window does.',
            side: 'bottom',
            align: 'end',
        },
        {
            id: 'nav-settings',
            element: '[data-tour="nav-settings"]',
            title: 'Settings',
            description:
                'Themes, your account, and the retrieval knobs for knowledgebases: chunk size, how many results get pulled into context.',
            side: 'right',
            align: 'end',
        },
        {
            id: 'done',
            title: "That's the whole loop",
            description:
                'Provider, then agent, then conversation, with documents and tools hung off the agent.<br><br>There is one more thing to show you, and the next screen asks whether you want it now.',
            align: 'center',
        },
    ],
}
