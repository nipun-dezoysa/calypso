import type { McpTransport } from '../../api/mcpApi'
import type { McpServerFormHandle } from './useMcpServerForm'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select'

const TRANSPORTS: { value: McpTransport; label: string }[] = [
    { value: 'stdio', label: 'stdio (local process)' },
    { value: 'streamable_http', label: 'streamable_http (URL)' },
    { value: 'sse', label: 'sse (URL)' },
    { value: 'websocket', label: 'websocket (URL)' },
]

interface McpServerFormFieldsProps {
    form: McpServerFormHandle
}

function McpServerFormFields({ form }: McpServerFormFieldsProps) {
    const {
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
        isUrlTransport,
    } = form

    return (
        <>
            <div className="form-field">
                <Label className="form-label" htmlFor="mcp-name">
                    Server Name
                    <span className="form-label-required">* required</span>
                </Label>
                <Input
                    id="mcp-name"
                    placeholder="e.g. filesystem"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
                    autoComplete="off"
                    spellCheck={false}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-field">
                <Label className="form-label" htmlFor="mcp-transport">Transport</Label>
                <Select
                    value={transport}
                    onValueChange={(value) => setTransport(value as McpTransport)}
                >
                    <SelectTrigger id="mcp-transport" className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TRANSPORTS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {!isUrlTransport ? (
                <>
                    <div className="form-field">
                        <Label className="form-label" htmlFor="mcp-command">
                            Command
                            <span className="form-label-required">* required</span>
                        </Label>
                        <Input
                            id="mcp-command"
                            placeholder="e.g. npx"
                            value={command}
                            onChange={(e) => { setCommand(e.target.value); setErrors((p) => ({ ...p, command: '' })) }}
                            spellCheck={false}
                        />
                        {errors.command && <div className="form-error">{errors.command}</div>}
                    </div>

                    <div className="form-field">
                        <Label className="form-label" htmlFor="mcp-args">
                            Arguments
                            <span className="form-label-optional">one per line</span>
                        </Label>
                        <Textarea
                            id="mcp-args"
                            rows={3}
                            placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir'}
                            value={argsText}
                            onChange={(e) => setArgsText(e.target.value)}
                            spellCheck={false}
                            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                        />
                    </div>

                    <div className="form-field">
                        <Label className="form-label" htmlFor="mcp-env">
                            Environment
                            <span className="form-label-optional">KEY=value per line</span>
                        </Label>
                        <Textarea
                            id="mcp-env"
                            rows={2}
                            placeholder={'API_KEY=sk-...\nDEBUG=1'}
                            value={envText}
                            onChange={(e) => setEnvText(e.target.value)}
                            spellCheck={false}
                            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                        />
                    </div>

                    <div className="form-field">
                        <Label className="form-label" htmlFor="mcp-cwd">
                            Working Directory
                            <span className="form-label-optional">optional</span>
                        </Label>
                        <Input
                            id="mcp-cwd"
                            placeholder="/path/to/working/dir"
                            value={cwd}
                            onChange={(e) => setCwd(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="form-field">
                        <Label className="form-label" htmlFor="mcp-url">
                            URL
                            <span className="form-label-required">* required</span>
                        </Label>
                        <Input
                            id="mcp-url"
                            placeholder="http://localhost:8000/mcp/"
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setErrors((p) => ({ ...p, url: '' })) }}
                            spellCheck={false}
                        />
                        {errors.url && <div className="form-error">{errors.url}</div>}
                    </div>

                    {transport !== 'websocket' && (
                        <div className="form-field">
                            <Label className="form-label" htmlFor="mcp-headers">
                                Headers
                                <span className="form-label-optional">Key: value per line</span>
                            </Label>
                            <Textarea
                                id="mcp-headers"
                                rows={2}
                                placeholder={'Authorization: Bearer token'}
                                value={headersText}
                                onChange={(e) => setHeadersText(e.target.value)}
                                spellCheck={false}
                                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                            />
                        </div>
                    )}
                </>
            )}

            <div className="form-field">
                <Label className="form-label" htmlFor="mcp-desc">
                    Description
                    <span className="form-label-optional">optional</span>
                </Label>
                <Input
                    id="mcp-desc"
                    placeholder="What this server provides"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <Label className="mcp-toggle">
                <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) => setEnabled(checked === true)}
                />
                <span>Enabled</span>
            </Label>
        </>
    )
}

export default McpServerFormFields
