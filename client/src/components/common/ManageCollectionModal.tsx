import { useState, useEffect, useRef, useCallback } from 'react'
import {
    IoCloudUploadOutline,
    IoTrashOutline,
    IoDocumentTextOutline,
    IoRefreshOutline,
    IoSaveOutline,
} from 'react-icons/io5'
import Modal from './Modal'
import ConfirmDeleteDialog from './ConfirmDeleteDialog'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
    listDocuments,
    uploadDocument,
    deleteDocument,
    updateCollection,
    deleteCollection,
    getCollection,
    type Collection,
    type KbDocument,
} from '../../api/kbApi'
import './ui.css'
import './kb.css'

const ACCEPTED = '.pdf,.txt,.md,.markdown'
const POLL_INTERVAL_MS = 2500

interface ManageCollectionModalProps {
    collection: Collection
    onClose: () => void
    onUpdated: (collection: Collection) => void
    onDeleted: (id: string) => void
}

function formatSize(bytes: number | null): string {
    if (bytes == null) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ doc }: { doc: KbDocument }) {
    const label =
        doc.status === 'completed'
            ? `${doc.chunk_count} chunk${doc.chunk_count === 1 ? '' : 's'}`
            : doc.status
    const variant =
        doc.status === 'completed'
            ? 'success'
            : doc.status === 'failed'
                ? 'destructive'
                : 'secondary'
    return (
        <Badge variant={variant} title={doc.error_message ?? undefined}>
            {(doc.status === 'pending' || doc.status === 'processing') && (
                <span className="ui-spinner kb-status-spinner" />
            )}
            {label}
        </Badge>
    )
}

function ManageCollectionModal({
    collection,
    onClose,
    onUpdated,
    onDeleted,
}: ManageCollectionModalProps) {
    const [documents, setDocuments] = useState<KbDocument[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    const [name, setName] = useState(collection.name)
    const [description, setDescription] = useState(collection.description ?? '')
    const [savingMeta, setSavingMeta] = useState(false)
    const [metaError, setMetaError] = useState<string | null>(null)

    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const metaDirty =
        name.trim() !== collection.name ||
        description.trim() !== (collection.description ?? '')

    const fetchDocuments = useCallback(async () => {
        try {
            const docs = await listDocuments(collection.id, { limit: 500 })
            setDocuments(docs)
            setLoadError(null)
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load documents')
        }
    }, [collection.id])

    useEffect(() => {
        fetchDocuments()
    }, [fetchDocuments])

    // Poll while any document is still being ingested.
    const hasPending = documents.some(
        (d) => d.status === 'pending' || d.status === 'processing',
    )
    useEffect(() => {
        if (!hasPending) return
        const id = setInterval(fetchDocuments, POLL_INTERVAL_MS)
        return () => clearInterval(id)
    }, [hasPending, fetchDocuments])

    // Keep the parent list's document_count in sync after ingestion settles.
    const refreshCount = useCallback(async () => {
        try {
            onUpdated(await getCollection(collection.id))
        } catch {
            /* non-fatal: the sidebar count will refresh on next open */
        }
    }, [collection.id, onUpdated])

    async function handleFilesSelected(files: FileList | null) {
        if (!files || files.length === 0) return
        setUploading(true)
        setLoadError(null)
        try {
            for (const file of Array.from(files)) {
                const created = await uploadDocument(collection.id, file)
                setDocuments((prev) => [created, ...prev])
            }
            await refreshCount()
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleDeleteDocument(documentId: string) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId))
        try {
            await deleteDocument(documentId)
            await refreshCount()
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to delete document')
            fetchDocuments()
        }
    }

    async function handleSaveMeta() {
        if (!name.trim()) {
            setMetaError('Name is required.')
            return
        }
        setSavingMeta(true)
        setMetaError(null)
        try {
            const updated = await updateCollection(collection.id, {
                name: name.trim(),
                description: description.trim() || null,
            })
            onUpdated(updated)
        } catch (err: unknown) {
            setMetaError(err instanceof Error ? err.message : 'Failed to save changes')
        } finally {
            setSavingMeta(false)
        }
    }

    async function handleConfirmDelete() {
        setDeleting(true)
        try {
            await deleteCollection(collection.id)
            onDeleted(collection.id)
            onClose()
        } catch (err: unknown) {
            setMetaError(err instanceof Error ? err.message : 'Failed to delete knowledgebase')
            setConfirmingDelete(false)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Modal
            title="Manage Knowledgebase"
            subtitle={collection.name}
            onClose={onClose}
            maxWidth={620}
            footer={
                <button className="btn btn--cancel" onClick={onClose} type="button">
                    Close
                </button>
            }
        >
            <ConfirmDeleteDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title="Delete Knowledgebase?"
                description={<>This permanently removes <strong>{collection.name}</strong>, all its documents, and their embeddings. This cannot be undone.</>}
                onConfirm={handleConfirmDelete}
                deleting={deleting}
                confirmLabel="Yes, Delete"
            />

            {metaError && <div className="form-error form-error--banner">{metaError}</div>}

            {/* ── Name / description ── */}
            <div className="form-field">
                <label className="form-label" htmlFor="mc-name">Name</label>
                <Input
                    id="mc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    spellCheck={false}
                />
            </div>
            <div className="form-field">
                <label className="form-label" htmlFor="mc-desc">
                    Description
                    <span className="form-label-optional">optional</span>
                </label>
                <Textarea
                    id="mc-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: 52 }}
                />
            </div>
            {metaDirty && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        onClick={handleSaveMeta}
                        disabled={savingMeta}
                        type="button"
                    >
                        {savingMeta ? (
                            <><span className="ui-spinner" /> Saving…</>
                        ) : (
                            <><IoSaveOutline style={{ fontSize: 15 }} /> Save Changes</>
                        )}
                    </Button>
                </div>
            )}

            <hr className="ui-divider" />

            {/* ── Documents ── */}
            <div className="kb-docs-header">
                <span className="form-label" style={{ margin: 0 }}>
                    Documents
                    <span className="kb-count-pill">{documents.length}</span>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchDocuments}
                        type="button"
                        title="Refresh"
                        aria-label="Refresh documents"
                    >
                        <IoRefreshOutline />
                    </Button>
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        type="button"
                    >
                        {uploading ? (
                            <><span className="ui-spinner" /> Uploading…</>
                        ) : (
                            <><IoCloudUploadOutline style={{ fontSize: 16 }} /> Upload</>
                        )}
                    </Button>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFilesSelected(e.target.files)}
            />

            <p className="kb-hint">Supported: PDF, TXT, Markdown. Files are embedded in the background.</p>

            {loadError && <div className="form-error">{loadError}</div>}

            {documents.length === 0 ? (
                <div className="kb-empty">No documents yet — upload a file to get started.</div>
            ) : (
                <div className="kb-doc-list">
                    {documents.map((doc) => (
                        <div key={doc.id} className="kb-doc-row group">
                            <IoDocumentTextOutline className="kb-doc-icon" />
                            <div className="kb-doc-info">
                                <span className="kb-doc-name" title={doc.filename}>{doc.filename}</span>
                                <span className="kb-doc-meta">
                                    {formatSize(doc.size_bytes)}
                                    {doc.status === 'failed' && doc.error_message && (
                                        <span className="kb-doc-error"> · {doc.error_message}</span>
                                    )}
                                </span>
                            </div>
                            <StatusBadge doc={doc} />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDocument(doc.id)}
                                title={`Delete ${doc.filename}`}
                                aria-label={`Delete ${doc.filename}`}
                            >
                                <IoTrashOutline size={14} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <hr className="ui-divider" />

            <div className="danger-zone">
                <div className="danger-zone__label">
                    <span className="danger-zone__title">Delete Knowledgebase</span>
                    <span className="danger-zone__desc">Removes this collection, its documents, and embeddings.</span>
                </div>
                <button className="btn--danger" onClick={() => setConfirmingDelete(true)} type="button">
                    <IoTrashOutline size={13} /> Delete
                </button>
            </div>
        </Modal>
    )
}

export default ManageCollectionModal
