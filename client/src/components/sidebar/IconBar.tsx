import React, { useState } from 'react'
import { IoChatboxOutline, IoLibraryOutline, IoGitNetworkOutline, IoExtensionPuzzleOutline, IoSettingsOutline, IoLogOutOutline } from 'react-icons/io5'
import { TbBrain } from 'react-icons/tb'
import { useSideBarStore } from '../../stores/SideBarStore'
import { useAuthStore } from '../../stores/AuthStore'
import type { SidebarSection } from '../../types/sidebar'
import { Button } from '../ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog'

function IconBar() {
    const { activeSection, setActiveSection, isCollapsed, setCollapsed } = useSideBarStore()
    const user = useAuthStore((s) => s.user)
    const logout = useAuthStore((s) => s.logout)
    const [confirmingLogout, setConfirmingLogout] = useState(false)

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
            <Button
                key={id}
                type='button'
                variant='ghost'
                size='icon'
                data-tour={`nav-${id}`}
                title={title}
                aria-label={title}
                onClick={() => handleSelect(id)}
                className={`text-2xl transition-all duration-200 hover:scale-105 ${
                    isActive ? 'text-(--c-accent)' : 'text-(--c-text-dim) hover:text-(--c-text-strong)'
                }`}
            >
                <IconComponent className="size-6" />
            </Button>
        )
    }

    return (
        <div className='p-3 text-2xl border-r border-(--c-border) text-(--c-text-dim) flex flex-col justify-between h-full select-none'>
            <div className='flex flex-col gap-5'>
                {navItems.map((item) => renderIcon(item.id, item.icon, item.title))}
            </div>
            <div className='flex flex-col gap-5'>
                {renderIcon('settings', IoSettingsOutline, 'Settings')}
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    title={user ? `Sign out (${user.username})` : 'Sign out'}
                    aria-label={user ? `Sign out (${user.username})` : 'Sign out'}
                    data-tour='nav-logout'
                    onClick={() => setConfirmingLogout(true)}
                    className='text-2xl transition-all duration-200 hover:scale-105 text-(--c-text-dim) hover:text-(--c-danger-text)'
                >
                    <IoLogOutOutline className="size-6" />
                </Button>
            </div>

            <AlertDialog open={confirmingLogout} onOpenChange={setConfirmingLogout}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sign out?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {user ? <>You'll be signed out of <strong>{user.username}</strong>.</> : "You'll be signed out."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); logout() }}>
                            Sign out
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default IconBar