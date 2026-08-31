import type { GraphSchemaInfo } from '../../api/graphDbApi'

const MAX_SHOWN = 12
const MAX_PATTERNS = 6

interface GraphSchemaPreviewProps {
    schema: GraphSchemaInfo
}

/** The schema an agent would see, summarised: labels, relationship types, and
 *  how they connect. */
function GraphSchemaPreview({ schema }: GraphSchemaPreviewProps) {
    const { nodes, relationships, patterns } = schema

    if (nodes.length === 0 && relationships.length === 0) {
        return (
            <p className="form-hint">
                Connected, but the graph is empty or its schema is not readable by this user.
            </p>
        )
    }

    return (
        <div className="graph-schema">
            {nodes.length > 0 && (
                <div className="graph-schema__group">
                    <span className="graph-schema__label">Node labels</span>
                    <div className="graph-schema__items">
                        {nodes.slice(0, MAX_SHOWN).map((n) => (
                            <span
                                key={n.label}
                                className="mcp-tool-pill"
                                title={n.properties.length > 0 ? n.properties.join(', ') : 'No properties'}
                            >
                                {n.label}
                            </span>
                        ))}
                        {nodes.length > MAX_SHOWN && (
                            <span className="graph-schema__more">
                                +{nodes.length - MAX_SHOWN} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            {relationships.length > 0 && (
                <div className="graph-schema__group">
                    <span className="graph-schema__label">Relationship types</span>
                    <div className="graph-schema__items">
                        {relationships.slice(0, MAX_SHOWN).map((r) => (
                            <span
                                key={r.type}
                                className="mcp-tool-pill"
                                title={r.properties.length > 0 ? r.properties.join(', ') : 'No properties'}
                            >
                                {r.type}
                            </span>
                        ))}
                        {relationships.length > MAX_SHOWN && (
                            <span className="graph-schema__more">
                                +{relationships.length - MAX_SHOWN} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            {patterns.length > 0 && (
                <div className="graph-schema__group">
                    <span className="graph-schema__label">How they connect</span>
                    <div className="graph-pattern-list">
                        {patterns.slice(0, MAX_PATTERNS).map((p) => (
                            <span key={p}>{p}</span>
                        ))}
                        {patterns.length > MAX_PATTERNS && (
                            <span className="graph-schema__more">
                                +{patterns.length - MAX_PATTERNS} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default GraphSchemaPreview
