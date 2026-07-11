import IconBar from './IconBar'
import SectionBar from './SectionBar'

function SideBar() {
    return (
        <div className='flex flex-col bg-zinc-950 '>
            <div className='text-zinc-400 font-semibold font-mono p-3 '>Calypso 1.0v</div>
            <div className='h-full flex border-t border-zinc-800'>
                <IconBar />
                <SectionBar />
            </div>
        </div>
    )
}

export default SideBar