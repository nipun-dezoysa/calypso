import { IoLockClosedOutline } from 'react-icons/io5'
import type { GraphDbFormHandle } from './useGraphDbForm'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'

interface GraphDbFormFieldsProps {
    form: GraphDbFormHandle
}

function GraphDbFormFields({ form }: GraphDbFormFieldsProps) {
    const {
        name, setName,
        uri, setUri,
        username, setUsername,
        password, setPassword,
        passwordUnchanged, clearStoredPassword,
        database, setDatabase,
        readOnly, setReadOnly,
        queryTimeout, setQueryTimeout,
        maxRows, setMaxRows,
        enabled, setEnabled,
        description, setDescription,
        errors, setErrors,
    } = form

    return (
        <>
            <div className="form-field">
                <Label className="form-label" htmlFor="gdb-name">
                    Name
                    <span className="form-label-required">* required</span>
                </Label>
                <Input
                    id="gdb-name"
                    placeholder="e.g. movies"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
                    autoComplete="off"
                    spellCheck={false}
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
                <p className="form-hint">
                    The agent sees this name in its tools, so make it recognisable.
                </p>
            </div>

            <div className="form-field">
                <Label className="form-label" htmlFor="gdb-uri">
                    Connection URI
                    <span className="form-label-required">* required</span>
                </Label>
                <Input
                    id="gdb-uri"
                    placeholder="bolt://localhost:7687"
                    value={uri}
                    onChange={(e) => { setUri(e.target.value); setErrors((p) => ({ ...p, uri: '' })) }}
                    autoComplete="off"
                    spellCheck={false}
                />
                {errors.uri && <div className="form-error">{errors.uri}</div>}
                <p className="form-hint">
                    Neo4j over Bolt. Use <code>neo4j+s://</code> for Aura and other TLS endpoints.
                </p>
            </div>

            <div className="graph-field-row">
                <div className="form-field">
                    <Label className="form-label" htmlFor="gdb-username">
                        Username
                        <span className="form-label-optional">optional</span>
                    </Label>
                    <Input
                        id="gdb-username"
                        placeholder="neo4j"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <div className="form-field">
                    <Label className="form-label" htmlFor="gdb-password">
                        Password
                        <span className="form-label-optional">optional</span>
                    </Label>
                    {passwordUnchanged ? (
                        <div className="graph-password-set">
                            <span><IoLockClosedOutline /> Password saved</span>
                            <button type="button" className="btn--link" onClick={clearStoredPassword}>
                                Replace
                            </button>
                        </div>
                    ) : (
                        <Input
                            id="gdb-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                        />
                    )}
                </div>
            </div>

            <div className="form-field">
                <Label className="form-label" htmlFor="gdb-database">
                    Database
                    <span className="form-label-optional">optional</span>
                </Label>
                <Input
                    id="gdb-database"
                    placeholder="Leave empty for the server's default"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>

            <div className="form-field">
                <Label className="form-label" htmlFor="gdb-desc">
                    Description
                    <span className="form-label-optional">optional</span>
                </Label>
                <Input
                    id="gdb-desc"
                    placeholder="What this graph holds, e.g. films, actors and directors"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <p className="form-hint">
                    Included in the agent's tool description, so it knows when to reach for this graph.
                </p>
            </div>

            <div className="graph-field-row">
                <div className="form-field">
                    <Label className="form-label" htmlFor="gdb-timeout">
                        Query timeout
                        <span className="form-label-optional">seconds</span>
                    </Label>
                    <Input
                        id="gdb-timeout"
                        type="number"
                        min={1}
                        max={120}
                        value={queryTimeout}
                        onChange={(e) => {
                            setQueryTimeout(Number(e.target.value))
                            setErrors((p) => ({ ...p, query_timeout: '' }))
                        }}
                    />
                    {errors.query_timeout && <div className="form-error">{errors.query_timeout}</div>}
                </div>

                <div className="form-field">
                    <Label className="form-label" htmlFor="gdb-maxrows">
                        Row limit
                        <span className="form-label-optional">per query</span>
                    </Label>
                    <Input
                        id="gdb-maxrows"
                        type="number"
                        min={1}
                        max={500}
                        value={maxRows}
                        onChange={(e) => {
                            setMaxRows(Number(e.target.value))
                            setErrors((p) => ({ ...p, max_rows: '' }))
                        }}
                    />
                    {errors.max_rows && <div className="form-error">{errors.max_rows}</div>}
                </div>
            </div>

            <div className="form-field">
                <Label className="mcp-toggle">
                    <Checkbox
                        checked={readOnly}
                        onCheckedChange={(checked) => setReadOnly(checked === true)}
                    />
                    <span>Read-only</span>
                </Label>
                <p className="form-hint">
                    {readOnly
                        ? 'Queries run in a read transaction, so the database itself rejects CREATE, MERGE, SET and DELETE.'
                        : 'The agent can modify this database. Only turn this off if you intend it to write.'}
                </p>
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

export default GraphDbFormFields
