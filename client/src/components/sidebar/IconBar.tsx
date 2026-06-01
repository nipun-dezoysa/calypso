import React from 'react'
import { IoChatboxOutline, IoLibraryOutline, IoGitNetworkOutline, IoExtensionPuzzleOutline, IoSettingsOutline } from 'react-icons/io5'
import { TbBrain } from 'react-icons/tb'

function IconBar() {
    return (
        <div className='p-3 text-2xl border-r border-zinc-800 text-zinc-400 flex flex-col justify-between'>
            <div className='flex flex-col gap-4'>
                <IoChatboxOutline title='Conversations' className='cursor-pointer hover:text-zinc-100 transition-colors' />
                <TbBrain title='AI Models' className='cursor-pointer hover:text-zinc-100 transition-colors' />
                <IoLibraryOutline title='Knowledgebases' className='cursor-pointer hover:text-zinc-100 transition-colors' />
                <IoGitNetworkOutline title='Workflows' className='cursor-pointer hover:text-zinc-100 transition-colors' />
                <IoExtensionPuzzleOutline title='MCPs' className='cursor-pointer hover:text-zinc-100 transition-colors' />
            </div>
            <div>
                <IoSettingsOutline title='Settings' className='cursor-pointer hover:text-zinc-100 transition-colors' />
            </div>
        </div>
    )
}

export default IconBar