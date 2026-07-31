import React from 'react'
import { IoChatboxOutline, IoLibraryOutline, IoGitNetworkOutline, IoExtensionPuzzleOutline, IoSettingsOutline } from 'react-icons/io5'
import { TbBrain } from 'react-icons/tb'
import { useSideBarStore } from '../../stores/SideBarStore'
import type { SidebarSection } from '../../types/sidebar'

function IconBar() {
    const { activeSection, setActiveSection, isCollapsed, setCollapsed } = useSideBarStore()

    const handleSelect = (id: SidebarSection) => {
        setActiveSection(id)
        if (isCollapsed) setCollapsed(false)
    }

    const navItems: { id: SidebarSection; icon: React.ComponentType<any>; title: string }[] = [
        { id: 'conversations', icon: IoChatboxOutline, title: 'Conversations' },
        { id: 'models', icon: TbBrain, title: 'AI Models' },
        { id: 'knowledgebases', icon: IoLibraryOutline, title: 'Knowledgebases' },
        { id: 'workflows', icon: IoGitNetworkOutline, title: 'Workflows' },
        { id: 'mcps', icon: IoExtensionPuzzleOutline, title: 'MCPs' },
    ]

    const renderIcon = (id: SidebarSection, IconComponent: React.ComponentType<any>, title: string) => {
        const isActive = activeSection === id
        return (
            <IconComponent
                key={id}
                title={title}
                onClick={() => handleSelect(id)}
                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-100'
                }`}
            />
        )
    }

    return (
        <div className='p-3 text-2xl border-r border-zinc-800 text-zinc-400 flex flex-col justify-between h-full select-none'>
            <div className='flex flex-col gap-5'>
                {navItems.map((item) => renderIcon(item.id, item.icon, item.title))}
            </div>
            <div>
                {renderIcon('settings', IoSettingsOutline, 'Settings')}
            </div>
        </div>
    )
}

export default IconBar