import { useEffect, useState } from 'react'
import { IoCheckmark, IoCodeSlashOutline } from 'react-icons/io5'

function apiOrigin(): string {
    const configured = import.meta.env.VITE_API_BASE_URL
    if (configured) return configured.replace(/\/$/, '')
    return window.location.origin
}

export function buildAskCurl(targetId: string): string {
    const body = JSON.stringify({ question: 'Hello!', thread_id: null })
    return [
        `curl -X POST '${apiOrigin()}/api/v1/chat/${targetId}/ask' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '${body}'`,
    ].join('\n')
}

async function copyText(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return
    }
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    try {
        if (!document.execCommand('copy')) throw new Error('copy command rejected')
    } finally {
        document.body.removeChild(area)
    }
}

interface CopyCurlButtonProps {
    /** Agent or workflow id the snippet should call. */
    targetId: string
    className?: string
}

function CopyCurlButton({ targetId, className = '' }: CopyCurlButtonProps) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

    useEffect(() => {
        if (state === 'idle') return
        const timer = setTimeout(() => setState('idle'), 2000)
        return () => clearTimeout(timer)
    }, [state])

    const handleCopy = async () => {
        try {
            await copyText(buildAskCurl(targetId))
            setState('copied')
        } catch {
            setState('failed')
        }
    }

    const label =
        state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy cURL'

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={`Copy a cURL request to the public /ask endpoint\n\n${buildAskCurl(targetId)}`}
            className={`flex items-center gap-1.5 text-xs border rounded px-2 py-1 whitespace-nowrap transition-colors ${
                state === 'copied'
                    ? 'border-emerald-700 text-emerald-400'
                    : state === 'failed'
                      ? 'border-red-800 text-red-400'
                      : 'border-zinc-700 text-zinc-300 hover:text-amber-400 hover:border-amber-600'
            } ${className}`}
        >
            {state === 'copied' ? <IoCheckmark /> : <IoCodeSlashOutline />}
            {label}
        </button>
    )
}

export default CopyCurlButton
