import { useState } from 'react'
import type {
    GraphDb,
    GraphDbCreate,
    GraphDbProvider,
    GraphDbUpdate,
} from '../../api/graphDbApi'

export type GraphDbFormValues = GraphDbCreate

export interface GraphDbFormHandle {
    name: string
    setName: (v: string) => void
    provider: GraphDbProvider
    setProvider: (v: GraphDbProvider) => void
    uri: string
    setUri: (v: string) => void
    username: string
    setUsername: (v: string) => void
    password: string
    setPassword: (v: string) => void
    /** True while an existing password is stored and the field is untouched. */
    passwordUnchanged: boolean
    clearStoredPassword: () => void
    database: string
    setDatabase: (v: string) => void
    readOnly: boolean
    setReadOnly: (v: boolean) => void
    queryTimeout: number
    setQueryTimeout: (v: number) => void
    maxRows: number
    setMaxRows: (v: number) => void
    enabled: boolean
    setEnabled: (v: boolean) => void
    description: string
    setDescription: (v: string) => void
    errors: Record<string, string>
    setErrors: (fn: (prev: Record<string, string>) => Record<string, string>) => void
    validate: () => boolean
    formValues: GraphDbFormValues
    /** Payload for a PATCH, which leaves an untouched password alone. */
    updateValues: GraphDbUpdate
}

export const URI_SCHEMES = [
    'bolt://',
    'bolt+s://',
    'bolt+ssc://',
    'neo4j://',
    'neo4j+s://',
    'neo4j+ssc://',
]

export function useGraphDbForm(initial?: GraphDb): GraphDbFormHandle {
    const [name, setName] = useState(initial?.name ?? '')
    const [provider, setProvider] = useState<GraphDbProvider>(initial?.provider ?? 'neo4j')
    const [uri, setUri] = useState(initial?.uri ?? '')
    const [username, setUsername] = useState(initial?.username ?? '')
    const [password, setPassword] = useState('')
    const [database, setDatabase] = useState(initial?.database ?? '')
    const [readOnly, setReadOnly] = useState(initial?.read_only ?? true)
    const [queryTimeout, setQueryTimeout] = useState(initial?.query_timeout ?? 15)
    const [maxRows, setMaxRows] = useState(initial?.max_rows ?? 50)
    const [enabled, setEnabled] = useState(initial?.enabled ?? true)
    const [description, setDescription] = useState(initial?.description ?? '')
    const [errors, setErrors] = useState<Record<string, string>>({})

    // The server never sends the password back, so an empty field on an
    // existing database means "keep what is stored", not "clear it". Clearing
    // is deliberate, through clearStoredPassword.
    const [storedPassword, setStoredPassword] = useState(initial?.password_set ?? false)
    const passwordUnchanged = storedPassword && password === ''

    function clearStoredPassword() {
        setStoredPassword(false)
        setPassword('')
    }

    function validate(): boolean {
        const errs: Record<string, string> = {}
        if (!name.trim()) errs.name = 'A name is required.'
        const trimmedUri = uri.trim()
        if (!trimmedUri) {
            errs.uri = 'A connection URI is required.'
        } else if (!URI_SCHEMES.some((scheme) => trimmedUri.startsWith(scheme))) {
            errs.uri = `URI must start with one of: ${URI_SCHEMES.join(', ')}`
        }
        if (queryTimeout < 1 || queryTimeout > 120) {
            errs.query_timeout = 'Timeout must be between 1 and 120 seconds.'
        }
        if (maxRows < 1 || maxRows > 500) {
            errs.max_rows = 'Row limit must be between 1 and 500.'
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const formValues: GraphDbFormValues = {
        name: name.trim(),
        provider,
        uri: uri.trim(),
        username: username.trim() || null,
        password: password || null,
        database: database.trim() || null,
        read_only: readOnly,
        query_timeout: queryTimeout,
        max_rows: maxRows,
        enabled,
        description: description.trim() || null,
    }

    // On a PATCH an omitted password keeps the stored one, so the key is
    // dropped unless the user actually typed or cleared it. Clearing sends an
    // empty string, which the server reads as "no password".
    const updateValues: GraphDbUpdate = { ...formValues }
    if (passwordUnchanged) {
        delete updateValues.password
    } else {
        updateValues.password = password || ''
    }

    return {
        name, setName,
        provider, setProvider,
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
        validate, formValues, updateValues,
    }
}
