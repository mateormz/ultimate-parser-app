// ============================================================================
// LR(0) Parser
// ============================================================================
class LR0Parser extends LRBase {
    constructor(grammar) {
        super(grammar);
        this.buildAutomaton();
        this.buildTables();
    }

    closure(items) {
        const result = items.map(i => ({ ...i }));
        const seen = new Set(result.map(i => this.itemKey(i)));
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < result.length; i++) {
                const item = result[i];
                const sym = this.nextSymbol(item);
                if (sym && this.grammar.isNonTerminal(sym)) {
                    for (let pIdx = 0; pIdx < this.grammar.productions.length; pIdx++) {
                        const p = this.grammar.productions[pIdx];
                        if (p.lhs === sym) {
                            const newItem = { prodIdx: pIdx, dot: 0 };
                            const key = this.itemKey(newItem);
                            if (!seen.has(key)) {
                                seen.add(key);
                                result.push(newItem);
                                changed = true;
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    gotoSet(items, symbol) {
        const moved = [];
        for (const item of items) {
            const sym = this.nextSymbol(item);
            if (sym === symbol) {
                moved.push({ prodIdx: item.prodIdx, dot: item.dot + 1 });
            }
        }
        return this.closure(moved);
    }

    buildTables() {
        const startProdIdx = 0; // S' → S
        for (let i = 0; i < this.states.length; i++) {
            const state = this.states[i];
            for (const item of state) {
                const sym = this.nextSymbol(item);
                if (sym && this.grammar.isTerminal(sym)) {
                    // shift
                    const target = (this.transitions[i] || {})[sym];
                    if (target !== undefined) {
                        this.addAction(i, sym, { type: 'shift', value: target });
                    }
                } else if (this.isComplete(item)) {
                    if (item.prodIdx === startProdIdx) {
                        this.addAction(i, Grammar.END_MARKER, { type: 'accept' });
                    } else {
                        // LR(0): reduce para todos los terminales
                        for (const t of this.grammar.terminals) {
                            this.addAction(i, t, { type: 'reduce', value: item.prodIdx });
                        }
                        this.addAction(i, Grammar.END_MARKER, { type: 'reduce', value: item.prodIdx });
                    }
                }
            }
            // GOTO para no-terminales
            for (const nt of this.grammar.nonTerminals) {
                const target = (this.transitions[i] || {})[nt];
                if (target !== undefined) this.addGoto(i, nt, target);
            }
        }
    }
}

// ============================================================================
// SLR(1) Parser
// Igual que LR(0) pero reduce solo cuando lookahead ∈ FOLLOW(A)
// ============================================================================
class SLR1Parser extends LR0Parser {
    buildTables() {
        // Reset
        this.action = {};
        this.goto = {};
        this.conflicts = [];
        const startProdIdx = 0;
        for (let i = 0; i < this.states.length; i++) {
            const state = this.states[i];
            for (const item of state) {
                const sym = this.nextSymbol(item);
                if (sym && this.grammar.isTerminal(sym)) {
                    const target = (this.transitions[i] || {})[sym];
                    if (target !== undefined) {
                        this.addAction(i, sym, { type: 'shift', value: target });
                    }
                } else if (this.isComplete(item)) {
                    if (item.prodIdx === startProdIdx) {
                        this.addAction(i, Grammar.END_MARKER, { type: 'accept' });
                    } else {
                        const prod = this.grammar.productions[item.prodIdx];
                        for (const t of this.grammar.follow[prod.lhs]) {
                            this.addAction(i, t, { type: 'reduce', value: item.prodIdx });
                        }
                    }
                }
            }
            for (const nt of this.grammar.nonTerminals) {
                const target = (this.transitions[i] || {})[nt];
                if (target !== undefined) this.addGoto(i, nt, target);
            }
        }
    }
}

// ============================================================================
// LR(1) Parser
// Items incluyen lookahead. Closure propaga lookaheads usando FIRST.
// ============================================================================
class LR1Parser extends LRBase {
    constructor(grammar) {
        super(grammar);
        this.buildAutomaton();
        this.buildTables();
    }

    initialItem() {
        return { prodIdx: 0, dot: 0, lookahead: Grammar.END_MARKER };
    }

    closure(items) {
        const result = items.map(i => ({ ...i }));
        const seen = new Set(result.map(i => this.itemKey(i)));
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < result.length; i++) {
                const item = result[i];
                const sym = this.nextSymbol(item);
                if (sym && this.grammar.isNonTerminal(sym)) {
                    const prod = this.grammar.productions[item.prodIdx];
                    // beta = símbolos después de B
                    const beta = prod.rhs.slice(item.dot + 1);
                    // Calcular FIRST(beta lookahead)
                    const lookaheads = this.grammar.firstOfString([...beta, item.lookahead]);
                    for (let pIdx = 0; pIdx < this.grammar.productions.length; pIdx++) {
                        const p = this.grammar.productions[pIdx];
                        if (p.lhs === sym) {
                            for (const la of lookaheads) {
                                if (la === Grammar.EPSILON) continue;
                                const newItem = { prodIdx: pIdx, dot: 0, lookahead: la };
                                const key = this.itemKey(newItem);
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    result.push(newItem);
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    gotoSet(items, symbol) {
        const moved = [];
        for (const item of items) {
            const sym = this.nextSymbol(item);
            if (sym === symbol) {
                moved.push({ prodIdx: item.prodIdx, dot: item.dot + 1, lookahead: item.lookahead });
            }
        }
        return this.closure(moved);
    }

    buildTables() {
        const startProdIdx = 0;
        for (let i = 0; i < this.states.length; i++) {
            const state = this.states[i];
            for (const item of state) {
                const sym = this.nextSymbol(item);
                if (sym && this.grammar.isTerminal(sym)) {
                    const target = (this.transitions[i] || {})[sym];
                    if (target !== undefined) {
                        this.addAction(i, sym, { type: 'shift', value: target });
                    }
                } else if (this.isComplete(item)) {
                    if (item.prodIdx === startProdIdx && item.lookahead === Grammar.END_MARKER) {
                        this.addAction(i, Grammar.END_MARKER, { type: 'accept' });
                    } else if (item.prodIdx !== startProdIdx) {
                        this.addAction(i, item.lookahead, { type: 'reduce', value: item.prodIdx });
                    }
                }
            }
            for (const nt of this.grammar.nonTerminals) {
                const target = (this.transitions[i] || {})[nt];
                if (target !== undefined) this.addGoto(i, nt, target);
            }
        }
    }
}

// ============================================================================
// LALR(1) Parser
// Construye LR(1) y luego fusiona estados con mismo "core" LR(0)
// ============================================================================
class LALR1Parser extends LR1Parser {
    constructor(grammar) {
        super(grammar);
        this.mergeStates();
        // Reconstruir tablas con estados fusionados
        this.action = {};
        this.goto = {};
        this.conflicts = [];
        this.buildTables();
    }

    coreKey(items) {
        return items.map(i => `${i.prodIdx}:${i.dot}`).sort().filter((v, idx, arr) => arr.indexOf(v) === idx).join('|');
    }

    mergeStates() {
        // Agrupar estados por core
        const coreGroups = new Map();
        for (let i = 0; i < this.states.length; i++) {
            const key = this.coreKey(this.states[i]);
            if (!coreGroups.has(key)) coreGroups.set(key, []);
            coreGroups.get(key).push(i);
        }

        // Construir mapa de estado-viejo -> estado-nuevo
        const remap = {};
        const newStates = [];
        let newIdx = 0;
        for (const [key, group] of coreGroups) {
            // Fusionar items (unir lookaheads para mismo core)
            const itemMap = new Map();
            for (const stateIdx of group) {
                for (const item of this.states[stateIdx]) {
                    const ck = `${item.prodIdx}:${item.dot}`;
                    if (!itemMap.has(ck)) {
                        itemMap.set(ck, { prodIdx: item.prodIdx, dot: item.dot, lookaheads: new Set() });
                    }
                    itemMap.get(ck).lookaheads.add(item.lookahead);
                }
            }
            // Expandir como items con lookahead individuales
            const mergedItems = [];
            for (const merged of itemMap.values()) {
                for (const la of merged.lookaheads) {
                    mergedItems.push({ prodIdx: merged.prodIdx, dot: merged.dot, lookahead: la });
                }
            }
            for (const oldIdx of group) remap[oldIdx] = newIdx;
            newStates.push(mergedItems);
            newIdx++;
        }
        // Re-mapear transiciones
        const newTransitions = {};
        for (const [fromOld, edges] of Object.entries(this.transitions)) {
            const fromNew = remap[fromOld];
            if (!newTransitions[fromNew]) newTransitions[fromNew] = {};
            for (const [sym, toOld] of Object.entries(edges)) {
                newTransitions[fromNew][sym] = remap[toOld];
            }
        }
        this.states = newStates;
        this.transitions = newTransitions;
    }
}

window.LR0Parser = LR0Parser;
window.SLR1Parser = SLR1Parser;
window.LR1Parser = LR1Parser;
window.LALR1Parser = LALR1Parser;
