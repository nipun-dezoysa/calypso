import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from 'react-icons/tb'
import IconBar from './IconBar'
import SectionBar from './SectionBar'
import { useSideBarStore } from '../../stores/SideBarStore'

function SideBar() {
    const { isCollapsed, toggleCollapsed } = useSideBarStore()

    return (
        <div className='flex flex-col bg-zinc-950 select-none'>
            <div className={`flex items-center p-3 ${isCollapsed ? 'justify-center' : 'justify-between gap-6'}`}>
                {!isCollapsed && (
                    <span className='text-zinc-400 font-semibold font-mono whitespace-nowrap'>Calypso 1.0v</span>
                )}
                <button
                    type='button'
                    onClick={toggleCollapsed}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className='text-2xl text-zinc-400 hover:text-zinc-100 cursor-pointer transition-all duration-200 hover:scale-105'
                >
                    {isCollapsed ? <TbLayoutSidebarLeftExpand /> : <TbLayoutSidebarLeftCollapse />}
                </button>
            </div>
            <div className='h-full flex border-t border-zinc-800 overflow-hidden'>
                <IconBar />
                {!isCollapsed && <SectionBar />}
            </div>
        </div>
    )
}

export default SideBar
