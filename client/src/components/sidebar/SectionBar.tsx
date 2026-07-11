import { useSideBarStore } from '../../stores/SideBarStore'
import AgentSection from './sections/AgentSection'
import ModelSection from './sections/ModelSection'
import KnowledgeSection from './sections/KnowledgeSection'
import WorkflowSection from './sections/WorkflowSection'
import McpSection from './sections/McpSection'
import SettingsSection from './sections/SettingsSection'

function SectionBar() {
    const { activeSection } = useSideBarStore()

    const renderActiveSection = () => {
        switch (activeSection) {
            case 'conversations':
                return <AgentSection />
            case 'models':
                return <ModelSection />
            case 'knowledgebases':
                return <KnowledgeSection />
            case 'workflows':
                return <WorkflowSection />
            case 'mcps':
                return <McpSection />
            case 'settings':
                return <SettingsSection />
            default:
                return <AgentSection />
        }
    }

    return (
        <div className='w-60 text-zinc-500 select-none'>
            {renderActiveSection()}
        </div>
    )
}

export default SectionBar