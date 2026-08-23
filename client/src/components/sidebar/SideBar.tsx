import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from 'react-icons/tb'
import IconBar from './IconBar'
import SectionBar from './SectionBar'
import { useSideBarStore } from '../../stores/SideBarStore'
import { Button } from '../ui/button'

function SideBar() {
    const { isCollapsed, toggleCollapsed } = useSideBarStore()

    return (
        <div className='flex flex-col bg-(--c-bg) select-none'>
            <div className={`flex items-center p-3 ${isCollapsed ? 'justify-center' : 'justify-between gap-6'}`}>
                {!isCollapsed && (
                    <span className='text-(--c-text-dim) font-semibold font-mono whitespace-nowrap'>Calypso 1.0v</span>
                )}
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={toggleCollapsed}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className='text-2xl text-(--c-text-dim) hover:text-(--c-text-strong) transition-all duration-200 hover:scale-105'
                >
                    {isCollapsed ? <TbLayoutSidebarLeftExpand className="size-6" /> : <TbLayoutSidebarLeftCollapse className="size-6" />}
                </Button>
            </div>
            <div className='h-full flex border-t border-(--c-border) overflow-hidden'>
                <IconBar />
                {!isCollapsed && <SectionBar />}
            </div>
        </div>
    )
}

export default SideBar
