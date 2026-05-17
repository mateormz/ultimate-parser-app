// ============================================================================
// Recursive Descent Parser
// Construye un AST simulando el descenso recursivo guiado por FIRST sets
// ============================================================================

class RecursiveDescentParser {
    constructor(grammar) {
        this.grammar = grammar;
        this.tokens = [];
        this.pos = 0;
        this.trace = [];
        this.depth = 0;
    }

    parse(input) {
        this.tokens = this.grammar.tokenize(input);
        this.pos = 0;
        this.trace = [];
        this.depth = 0;

        if (this.grammar.hasLeftRecursion()) {
            return {
                success: false,
                error: 'La gramática tiene recursión izquierda. El descenso recursivo no puede manejar esto sin caer en bucle infinito. Considera eliminar la recursión izquierda primero.',
                trace: this.trace,
                ast: null,
                tables: null,
                tokens: this.tokens
            };
        }

        try {
            const ast = this.parseSymbol(this.grammar.startSymbol);
            if (this.tokens[this.pos] !== Grammar.END_MARKER) {
                return {
                    success: false,
                    error: `Tokens sobrantes después del análisis. Token actual: '${this.tokens[this.pos]}' en posición ${this.pos}.`,
                    trace: this.trace,
                    ast: ast,
                    tables: null,
                    tokens: this.tokens
                };
            }
            this.trace.push({
                type: 'success',
                message: '✓ Cadena aceptada por descenso recursivo',
                depth: 0
            });
            return {
                success: true,
                error: null,
                trace: this.trace,
                ast: ast,
                tables: null,
                tokens: this.tokens
            };
        } catch (e) {
            return {
                success: false,
                error: e.message,
                trace: this.trace,
                ast: null,
                tables: null,
                tokens: this.tokens
            };
        }
    }

    parseSymbol(symbol) {
        const node = { name: symbol, children: [] };
        this.trace.push({
            type: 'expand',
            message: `Intentando expandir ${symbol}, lookahead='${this.tokens[this.pos]}'`,
            depth: this.depth,
            stack: this.snapshot()
        });

        if (this.grammar.isTerminal(symbol) || symbol === Grammar.EPSILON) {
            // Es terminal
            if (symbol === Grammar.EPSILON) {
                node.children.push({ name: 'ε', children: [], leaf: true });
                return node;
            }
            if (this.tokens[this.pos] === symbol) {
                this.trace.push({
                    type: 'match',
                    message: `Match terminal '${symbol}'`,
                    depth: this.depth + 1
                });
                node.leaf = true;
                node.token = symbol;
                this.pos++;
                return node;
            } else {
                throw new Error(`Se esperaba '${symbol}' pero se encontró '${this.tokens[this.pos]}'`);
            }
        }

        // Es no-terminal: seleccionar producción
        const productions = this.grammar.getProductionsFor(symbol);
        const lookahead = this.tokens[this.pos];

        let selected = null;
        let epsilonProd = null;
        for (const prod of productions) {
            const firstSet = this.grammar.firstOfString(prod.rhs);
            if (firstSet.has(lookahead)) {
                selected = prod;
                break;
            }
            if (firstSet.has(Grammar.EPSILON)) epsilonProd = prod;
        }
        if (!selected && epsilonProd && this.grammar.follow[symbol].has(lookahead)) {
            selected = epsilonProd;
        }
        // Fallback: si solo hay una producción, intentarla
        if (!selected && productions.length === 1) {
            selected = productions[0];
        }

        if (!selected) {
            throw new Error(`No se puede expandir ${symbol} con lookahead '${lookahead}'. Ninguna producción aplica.`);
        }

        this.trace.push({
            type: 'production',
            message: `Aplicar ${symbol} → ${selected.rhs.join(' ')}`,
            depth: this.depth + 1
        });

        this.depth++;
        for (const sym of selected.rhs) {
            if (sym === Grammar.EPSILON) {
                node.children.push({ name: 'ε', children: [], leaf: true });
            } else {
                node.children.push(this.parseSymbol(sym));
            }
        }
        this.depth--;
        return node;
    }

    snapshot() {
        return {
            position: this.pos,
            remaining: this.tokens.slice(this.pos).join(' ')
        };
    }
}

window.RecursiveDescentParser = RecursiveDescentParser;
