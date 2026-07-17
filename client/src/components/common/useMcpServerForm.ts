import { useState } from 'react'
import type { McpServer, McpServerCreate, McpTransport } from '../../api/mcpApi'

export type McpServerFormValues = McpServerCreate

export interface McpServerFormHandle {
    name: string
    setName: (v: string) => void
    transport: McpTransport
    setTransport: (v: McpTransport) => void
    command: string
    setCommand: (v: string) => void
    argsText: string
    setArgsText: (v: string) => void
    envText: string
    setEnvText: (v: string) => void
    cwd: string
    setCwd: (v: string) => void
    url: string
    setUrl: (v: string) => void
    headersText: string
    setHeadersText: (v: string) => void
    enabled: boolean
    setEnabled: (v: boolean) => void
    description: string
    setDescription: (v: string) => void
    errors: Record<string, string>
    setErrors: (fn: (prev: Record<string, string>) => Record<string, string>) => void
    isUrlTransport: boolean
    validate: () => boolean
    formValues: McpServerFormValues
}

export function isUrlTransport(transport: McpTransport): boolean {
    return transport !== 'stdio'
}

/** "KEY=value" or "Key: value" pairs, one per line, into an object. */
function parseKeyVals(text: string): Record<string, string> {
    const out: Record<string, string> = {}
    for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const sep = trimmed.search(/[=:]/)
        if (sep === -1) continue
        const key = trimmed.slice(0, sep).trim()
        const value = trimmed.slice(sep + 1).trim()
        if (key) out[key] = value
    }
    return out
}

function stringifyKeyVals(obj: Record<string, string> | undefined): string {
    if (!obj) return ''
    return Object.entries(obj)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
}

function parseLines(text: string): string[] {
    return text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
}

export function useMcpServerForm(initial?: McpServer): McpServerFormHandle {
    const [name, setName] = useState(initial?.name ?? '')
    const [transport, setTransport] = useState<McpTransport>(initial?.transport ?? 'stdio')
    const [command, setCommand] = useState(initial?.command ?? '')
    const [argsText, setArgsText] = useState((initial?.args ?? []).join('\n'))
    const [envText, setEnvText] = useState(stringifyKeyVals(initial?.env))
    const [cwd, setCwd] = useState(initial?.cwd ?? '')
    const [url, setUrl] = useState(initial?.url ?? '')
    const [headersText, setHeadersText] = useState(stringifyKeyVals(initial?.headers))
    const [enabled, setEnabled] = useState(initial?.enabled ?? true)
    const [description, setDescription] = useState(initial?.description ?? '')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const urlTransport = isUrlTransport(transport)

    function validate(): boolean {
        const errs: Record<string, string> = {}
        if (!name.trim()) errs.name = 'Server name is required.'
        if (transport === 'stdio' && !command.trim()) {
            errs.command = 'Command is required for stdio transport.'
        }
        if (urlTransport && !url.trim()) {
            errs.url = 'URL is required for this transport.'
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const formValues: McpServerFormValues = {
        name: name.trim(),
        transport,
        command: transport === 'stdio' ? command.trim() || null : null,
        args: transport === 'stdio' ? parseLines(argsText) : [],
        env: transport === 'stdio' ? parseKeyVals(envText) : {},
        cwd: transport === 'stdio' ? cwd.trim() || null : null,
        url: urlTransport ? url.trim() || null : null,
        headers: urlTransport ? parseKeyVals(headersText) : {},
        enabled,
        description: description.trim() || null,
    }

    return {
        name, setName,
        transport, setTransport,
        command, setCommand,
        argsText, setArgsText,
        envText, setEnvText,
        cwd, setCwd,
        url, setUrl,
        headersText, setHeadersText,
        enabled, setEnabled,
        description, setDescription,
        errors, setErrors,
        isUrlTransport: urlTransport,
        validate, formValues,
    }
}
