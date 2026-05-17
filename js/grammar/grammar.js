// ============================================================================
// Grammar Module
// Parsing de gramáticas en notación BNF: A -> B C | D
// Calcula FIRST, FOLLOW, detecta recursión izquierda, factorización
// ============================================================================

const EPSILON = 'ε';
const END_MARKER = '$';

class Grammar {
    constructor(text) {
        this.text = text;
        this.productions = [];      // Array de {lhs, rhs: [symbols]}
        this.nonTerminals = new Set();
        this.terminals = new Set();
        this.startSymbol = null;
        this.first = {};
        this.follow = {};
        this.parse();
        this.computeFirst();
        this.computeFollow();
    }

    parse() {
        const lines = this.text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('#'));
        if (lines.length === 0) throw new Error('La gramática está vacía');

        for (const line of lines) {
            // Soportar -> y →
            const arrow = line.includes('->') ? '->' : (line.includes('→') ? '→' : null);
            if (!arrow) throw new Error(`Línea sin '->': ${line}`);
            const parts = line.split(arrow);
            const lhs = parts[0].trim();
            const rhsStr = parts.slice(1).join(arrow).trim();
            if (!lhs) throw new Error(`Lado izquierdo vacío en: ${line}`);
            if (!/^[A-Z][A-Za-z0-9_']*$/.test(lhs)) {
                throw new Error(`No terminal inválido (debe empezar con mayúscula): "${lhs}"`);
            }

            this.nonTerminals.add(lhs);
            if (this.startSymbol === null) this.startSymbol = lhs;

            const alternatives = rhsStr.split('|').map(a => a.trim());
            for (const alt of alternatives) {
                let symbols;
                if (alt === '' || alt === EPSILON || alt === 'epsilon' || alt === 'ε') {
                    symbols = [EPSILON];
                } else {
                    symbols = alt.split(/\s+/).filter(s => s.length > 0);
                }
                this.productions.push({ lhs, rhs: symbols });
            }
        }

        // Identificar terminales (todo lo que no es no-terminal)
        for (const prod of this.productions) {
            for (const sym of prod.rhs) {
                if (sym === EPSILON) continue;
                if (!this.nonTerminals.has(sym)) {
                    this.terminals.add(sym);
                }
            }
        }
    }

    isNonTerminal(symbol) {
        return this.nonTerminals.has(symbol);
    }

    isTerminal(symbol) {
        return this.terminals.has(symbol) || symbol === END_MARKER;
    }

    getProductionsFor(nt) {
        return this.productions.filter(p => p.lhs === nt);
    }

    // ----- FIRST -----
    computeFirst() {
        for (const t of this.terminals) this.first[t] = new Set([t]);
        for (const nt of this.nonTerminals) this.first[nt] = new Set();
        this.first[EPSILON] = new Set([EPSILON]);

        let changed = true;
        while (changed) {
            changed = false;
            for (const prod of this.productions) {
                const before = new Set(this.first[prod.lhs]);
                const firstOfRhs = this.firstOfString(prod.rhs);
                for (const x of firstOfRhs) this.first[prod.lhs].add(x);
                if (this.first[prod.lhs].size !== before.size) changed = true;
            }
        }
    }

    firstOfString(symbols) {
        const result = new Set();
        if (symbols.length === 0 || (symbols.length === 1 && symbols[0] === EPSILON)) {
            result.add(EPSILON);
            return result;
        }
        let allHaveEpsilon = true;
        for (const sym of symbols) {
            if (sym === EPSILON) {
                result.add(EPSILON);
                continue;
            }
            const firstSet = this.first[sym] || new Set([sym]);
            for (const x of firstSet) {
                if (x !== EPSILON) result.add(x);
            }
            if (!firstSet.has(EPSILON)) {
                allHaveEpsilon = false;
                break;
            }
        }
        if (allHaveEpsilon) result.add(EPSILON);
        return result;
    }

    // ----- FOLLOW -----
    computeFollow() {
        for (const nt of this.nonTerminals) this.follow[nt] = new Set();
        this.follow[this.startSymbol].add(END_MARKER);

        let changed = true;
        while (changed) {
            changed = false;
            for (const prod of this.productions) {
                const { lhs, rhs } = prod;
                for (let i = 0; i < rhs.length; i++) {
                    const B = rhs[i];
                    if (!this.isNonTerminal(B)) continue;
                    const beta = rhs.slice(i + 1);
                    const before = new Set(this.follow[B]);
                    if (beta.length === 0) {
                        for (const x of this.follow[lhs]) this.follow[B].add(x);
                    } else {
                        const firstBeta = this.firstOfString(beta);
                        for (const x of firstBeta) {
                            if (x !== EPSILON) this.follow[B].add(x);
                        }
                        if (firstBeta.has(EPSILON)) {
                            for (const x of this.follow[lhs]) this.follow[B].add(x);
                        }
                    }
                    if (this.follow[B].size !== before.size) changed = true;
                }
            }
        }
    }

    // ----- Análisis de Gramática -----
    hasLeftRecursion() {
        // Recursión izquierda directa
        for (const prod of this.productions) {
            if (prod.rhs.length > 0 && prod.rhs[0] === prod.lhs) return true;
        }
        return false;
    }

    findLeftRecursive() {
        const result = [];
        for (const nt of this.nonTerminals) {
            const prods = this.getProductionsFor(nt);
            for (const p of prods) {
                if (p.rhs.length > 0 && p.rhs[0] === nt) {
                    result.push(nt);
                    break;
                }
            }
        }
        return result;
    }

    needsLeftFactoring() {
        for (const nt of this.nonTerminals) {
            const prods = this.getProductionsFor(nt);
            const prefixes = {};
            for (const p of prods) {
                const first = p.rhs[0] || EPSILON;
                if (first === EPSILON) continue;
                prefixes[first] = (prefixes[first] || 0) + 1;
                if (prefixes[first] > 1) return true;
            }
        }
        return false;
    }

    isLL1() {
        // Verifica si la gramática es LL(1)
        for (const nt of this.nonTerminals) {
            const prods = this.getProductionsFor(nt);
            if (prods.length < 2) continue;
            for (let i = 0; i < prods.length; i++) {
                for (let j = i + 1; j < prods.length; j++) {
                    const first_i = this.firstOfString(prods[i].rhs);
                    const first_j = this.firstOfString(prods[j].rhs);
                    // FIRST(α_i) ∩ FIRST(α_j) = ∅
                    const intersection = [...first_i].filter(x => first_j.has(x) && x !== EPSILON);
                    if (intersection.length > 0) return false;
                    // Si ε ∈ FIRST(α_i) entonces FIRST(α_j) ∩ FOLLOW(A) = ∅
                    if (first_i.has(EPSILON)) {
                        const conflict = [...first_j].filter(x => this.follow[nt].has(x));
                        if (conflict.length > 0) return false;
                    }
                    if (first_j.has(EPSILON)) {
                        const conflict = [...first_i].filter(x => this.follow[nt].has(x));
                        if (conflict.length > 0) return false;
                    }
                }
            }
        }
        return true;
    }

    // ----- Tokenización de strings de entrada -----
    tokenize(input) {
        // Tokenización simple: split por whitespace
        // Si la entrada está vacía, retornar [END_MARKER]
        const tokens = input.trim().split(/\s+/).filter(t => t.length > 0);
        tokens.push(END_MARKER);
        return tokens;
    }

    // Gramática aumentada para LR
    augment() {
        const augmented = new Grammar.__skip__();
        augmented.text = this.text;
        augmented.productions = [];
        augmented.nonTerminals = new Set(this.nonTerminals);
        augmented.terminals = new Set(this.terminals);
        const newStart = this.startSymbol + "'";
        augmented.startSymbol = newStart;
        augmented.nonTerminals.add(newStart);
        augmented.productions.push({ lhs: newStart, rhs: [this.startSymbol] });
        for (const p of this.productions) {
            augmented.productions.push({ lhs: p.lhs, rhs: [...p.rhs] });
        }
        // Copiar first/follow original y extender
        augmented.first = {};
        augmented.follow = {};
        Grammar.prototype.computeFirst.call(augmented);
        Grammar.prototype.computeFollow.call(augmented);
        return augmented;
    }
}

// Truco para crear instancia sin re-parsear
Grammar.__skip__ = function() {};
Grammar.__skip__.prototype = Grammar.prototype;

Grammar.EPSILON = EPSILON;
Grammar.END_MARKER = END_MARKER;

// Helper: formatear conjunto como string
function setToString(set) {
    if (!set || set.size === 0) return '∅';
    return '{ ' + [...set].join(', ') + ' }';
}

// Helper: producción a string
function prodToString(prod) {
    return `${prod.lhs} → ${prod.rhs.join(' ')}`;
}

// Exponer al ámbito global
window.Grammar = Grammar;
window.GrammarUtils = { setToString, prodToString, EPSILON, END_MARKER };
