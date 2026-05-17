// ============================================================================
// Visualizers
// - AST a Mermaid
// - Autómata LR a Mermaid
// ============================================================================

let __mermaidNodeCounter = 0;
function genId() {
    return 'n' + (__mermaidNodeCounter++);
}

function astToMermaid(ast) {
    __mermaidNodeCounter = 0;
    if (!ast) return 'graph TD\n  empty[No AST]';
    const lines = ['graph TD'];
    const styles = [];

    function escape(s) {
        return String(s).replace(/"/g, '&quot;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
    }

    function visit(node) {
        const id = genId();
        const label = escape(node.name);
        const isLeaf = node.leaf || (!node.children || node.children.length === 0);
        if (isLeaf) {
            lines.push(`  ${id}(["${label}"])`);
            styles.push(`  style ${id} fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#78350f`);
        } else {
            lines.push(`  ${id}["${label}"]`);
            styles.push(`  style ${id} fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a`);
        }
        if (node.children) {
            for (const child of node.children) {
                const childId = visit(child);
                lines.push(`  ${id} --> ${childId}`);
            }
        }
        return id;
    }

    visit(ast);
    return lines.concat(styles).join('\n');
}

function automatonToMermaid(states, transitions, parser) {
    const lines = ['graph LR'];
    lines.push('  classDef stateNode fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3');
    for (let i = 0; i < states.length; i++) {
        const stateLabel = `I${i}`;
        // Listar items resumidos (máx 4 para no saturar)
        let preview = '';
        if (parser) {
            const itemStrs = states[i].slice(0, 3).map(it => parser.itemToString(it));
            preview = itemStrs.join('<br/>');
            if (states[i].length > 3) preview += `<br/>... +${states[i].length - 3} más`;
        }
        const label = preview ? `${stateLabel}<br/><font size='1'>${preview.replace(/"/g, "'")}</font>` : stateLabel;
        lines.push(`  S${i}["${label}"]:::stateNode`);
    }
    for (const [from, edges] of Object.entries(transitions || {})) {
        for (const [sym, to] of Object.entries(edges)) {
            lines.push(`  S${from} -->|"${sym}"| S${to}`);
        }
    }
    return lines.join('\n');
}

window.Visualizers = { astToMermaid, automatonToMermaid };
