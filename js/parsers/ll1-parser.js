// ============================================================================
// LL(1) Predictive Parser
// Construye tabla M[A, a] y procesa con stack
// ============================================================================

class LL1Parser {
    constructor(grammar) {
        this.grammar = grammar;
        this.table = {};      // table[nonTerminal][terminal] = production
        this.conflicts = [];
        this.buildTable();
    }

    buildTable() {
        for (const nt of this.grammar.nonTerminals) {
            this.table[nt] = {};
        }

        for (let i = 0; i < this.grammar.productions.length; i++) {
            const prod = this.grammar.productions[i];
            const firstAlpha = this.grammar.firstOfString(prod.rhs);

            for (const terminal of firstAlpha) {
                if (terminal === Grammar.EPSILON) continue;
                if (this.table[prod.lhs][terminal]) {
                    this.conflicts.push({
                        nonTerminal: prod.lhs,
                        terminal: terminal,
                        existing: this.table[prod.lhs][terminal],
                        new: prod,
                        type: 'FIRST/FIRST'
                    });
                }
                this.table[prod.lhs][terminal] = prod;
            }

            if (firstAlpha.has(Grammar.EPSILON)) {
                for (const terminal of this.grammar.follow[prod.lhs]) {
                    if (this.table[prod.lhs][terminal]) {
                        if (this.table[prod.lhs][terminal] !== prod) {
                            this.conflicts.push({
                                nonTerminal: prod.lhs,
                                terminal: terminal,
                                existing: this.table[prod.lhs][terminal],
                                new: prod,
                                type: 'FIRST/FOLLOW'
                            });
                        }
                    }
                    this.table[prod.lhs][terminal] = prod;
                }
            }
        }
    }

    parse(input) {
        const tokens = this.grammar.tokenize(input);
        const trace = [];
        const stack = [Grammar.END_MARKER, this.grammar.startSymbol];
        let pos = 0;
        let stepNum = 0;

        if (this.conflicts.length > 0) {
            return {
                success: false,
                error: `La gramática no es LL(1). Hay ${this.conflicts.length} conflicto(s) en la tabla. Revisa la pestaña de Tabla para ver los detalles.`,
                trace: [],
                ast: null,
                tables: { ll1: this.table, conflicts: this.conflicts },
                tokens
            };
        }

        // Para construir el árbol de derivación, mantenemos referencias en el stack
        const root = { name: this.grammar.startSymbol, children: [] };
        const nodeStack = [null, root]; // emparejado con stack

        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            const topNode = nodeStack[nodeStack.length - 1];
            const current = tokens[pos];
            stepNum++;

            const step = {
                step: stepNum,
                stack: [...stack].reverse().join(' '),
                input: tokens.slice(pos).join(' '),
                action: ''
            };

            if (top === Grammar.END_MARKER && current === Grammar.END_MARKER) {
                step.action = '✓ Aceptar';
                trace.push(step);
                return {
                    success: true,
                    error: null,
                    trace,
                    ast: root,
                    tables: { ll1: this.table, conflicts: this.conflicts },
                    tokens
                };
            }

            if (this.grammar.isTerminal(top) || top === Grammar.END_MARKER) {
                if (top === current) {
                    step.action = `Match '${top}'`;
                    if (topNode) {
                        topNode.leaf = true;
                        topNode.token = top;
                    }
                    stack.pop();
                    nodeStack.pop();
                    pos++;
                } else {
                    step.action = `✗ Error: se esperaba '${top}' pero se encontró '${current}'`;
                    trace.push(step);
                    return {
                        success: false,
                        error: `Error sintáctico: se esperaba '${top}' pero se encontró '${current}' en posición ${pos}`,
                        trace,
                        ast: null,
                        tables: { ll1: this.table, conflicts: this.conflicts },
                        tokens
                    };
                }
            } else {
                // Es no-terminal
                const prod = this.table[top] && this.table[top][current];
                if (!prod) {
                    step.action = `✗ Error: no hay producción M[${top}, ${current}]`;
                    trace.push(step);
                    return {
                        success: false,
                        error: `Error sintáctico: no existe entrada en la tabla M[${top}, ${current}]. El símbolo '${current}' no puede iniciar una expansión de ${top}.`,
                        trace,
                        ast: null,
                        tables: { ll1: this.table, conflicts: this.conflicts },
                        tokens
                    };
                }
                step.action = `${top} → ${prod.rhs.join(' ')}`;
                stack.pop();
                nodeStack.pop();
                // Push en reverso, y construir hijos del nodo
                const children = [];
                for (const sym of prod.rhs) {
                    const childNode = { name: sym, children: [] };
                    if (sym === Grammar.EPSILON) {
                        childNode.leaf = true;
                    }
                    children.push(childNode);
                }
                if (topNode) topNode.children = children;
                for (let i = prod.rhs.length - 1; i >= 0; i--) {
                    if (prod.rhs[i] === Grammar.EPSILON) continue;
                    stack.push(prod.rhs[i]);
                    nodeStack.push(children[i]);
                }
            }
            trace.push(step);

            if (stepNum > 10000) {
                return {
                    success: false,
                    error: 'Demasiados pasos. Posible bucle infinito.',
                    trace,
                    ast: null,
                    tables: { ll1: this.table, conflicts: this.conflicts },
                    tokens
                };
            }
        }

        return {
            success: false,
            error: 'Stack vaciado prematuramente',
            trace,
            ast: null,
            tables: { ll1: this.table, conflicts: this.conflicts },
            tokens
        };
    }
}

window.LL1Parser = LL1Parser;
