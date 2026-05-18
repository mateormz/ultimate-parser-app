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

function parseTreeToAst(parseTree) {
    if (!parseTree) return null;

    const tokens = collectTerminalTokens(parseTree);
    const expressionTokens = tokens.filter(t => t !== '$');
    const hasExpressionOperator = expressionTokens.some(t => ['+', '-', '*', '/', '**', '^'].includes(t));

    if (expressionTokens[0] === 'print') {
        const args = extractPrintArgs(expressionTokens);
        return {
            name: 'print',
            children: args.length > 0 ? args.map(parseExpressionTokens).filter(Boolean) : []
        };
    }

    if (hasExpressionOperator || expressionTokens.includes('(')) {
        const ast = parseExpressionTokens(expressionTokens);
        if (ast) return ast;
    }

    return null;
}

function collectTerminalTokens(node) {
    if (!node) return [];
    const children = node.children || [];
    if (node.leaf || children.length === 0) {
        return isIgnoredAstToken(node.name) ? [] : [node.token || node.name];
    }
    return children.flatMap(collectTerminalTokens);
}

function extractPrintArgs(tokens) {
    const openIdx = tokens.indexOf('(');
    const closeIdx = tokens.lastIndexOf(')');
    if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) {
        return [tokens.slice(1)];
    }

    const inside = tokens.slice(openIdx + 1, closeIdx);
    const args = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < inside.length; i++) {
        if (inside[i] === '(') depth++;
        else if (inside[i] === ')') depth--;
        else if (inside[i] === ',' && depth === 0) {
            args.push(inside.slice(start, i));
            start = i + 1;
        }
    }
    args.push(inside.slice(start));
    return args.filter(arg => arg.length > 0);
}

function parseExpressionTokens(tokens) {
    let pos = 0;
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '**': 3, '^': 3 };

    function parseExpression(minPrec = 0) {
        let left = parsePrimary();
        if (!left) return null;

        while (pos < tokens.length) {
            const op = tokens[pos];
            const prec = precedence[op];
            if (!prec || prec < minPrec) break;

            pos++;
            const nextMinPrec = (op === '**' || op === '^') ? prec : prec + 1;
            const right = parseExpression(nextMinPrec);
            if (!right) break;
            left = { name: op, children: [left, right] };
        }
        return left;
    }

    function parsePrimary() {
        const token = tokens[pos++];
        if (!token || token === ')' || token === ',') return null;
        if (token === '(') {
            const expr = parseExpression(0);
            if (tokens[pos] === ')') pos++;
            return expr;
        }
        return { name: token, leaf: true, children: [] };
    }

    return parseExpression(0);
}

function isIgnoredAstToken(value) {
    return value === 'ε' || value === 'Îµ' || value === '$';
}

function automatonToMermaid(states, transitions, parser, options = {}) {
    const expanded = options.expanded === true;
    const lines = ['graph LR'];
    lines.push('  classDef stateNode fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3');
    for (let i = 0; i < states.length; i++) {
        const stateLabel = `I${i}`;
        // Compacto por defecto; expandido cuando se solicita desde la UI.
        let preview = '';
        if (parser) {
            const visibleItems = expanded ? states[i] : states[i].slice(0, 3);
            const itemStrs = visibleItems.map(it => parser.itemToString(it));
            preview = itemStrs.join('<br/>');
            if (!expanded && states[i].length > 3) {
                preview += `<br/>... +${states[i].length - 3} m&aacute;s`;
            }
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

window.Visualizers = { astToMermaid, parseTreeToAst, automatonToMermaid };
