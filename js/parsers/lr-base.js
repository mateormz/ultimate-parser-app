// ============================================================================
// LR Parsing Base
// Compartido por LR(0), SLR(1), LALR(1), LR(1)
// Contiene: items, closure, goto, construcción de autómata, motor de parseo
// ============================================================================

// LR(0) item: { prodIdx, dot } (dot = posición del punto en rhs)
// LR(1) item: { prodIdx, dot, lookahead }

class LRBase {
    constructor(grammar) {
        this.originalGrammar = grammar;
        this.grammar = grammar.augment();
        this.wasAutoAugmented = this.grammar.wasAutoAugmented;
        this.states = [];      // Array de itemsets
        this.transitions = {}; // transitions[stateIdx][symbol] = stateIdx
        this.action = {};      // action[stateIdx][terminal] = {type, value}
        this.goto = {};        // goto[stateIdx][nonTerminal] = stateIdx
        this.conflicts = [];
    }

    itemToString(item) {
        const prod = this.grammar.productions[item.prodIdx];
        const before = prod.rhs.slice(0, item.dot).join(' ');
        const after = prod.rhs.slice(item.dot).join(' ');
        let s = `${prod.lhs} → ${before} • ${after}`.replace(/\s+/g, ' ').replace(' • ε', ' •').replace('ε •', '•');
        if (item.lookahead !== undefined) {
            s += `, ${item.lookahead}`;
        }
        return s;
    }

    itemKey(item) {
        return item.lookahead !== undefined
            ? `${item.prodIdx}:${item.dot}:${item.lookahead}`
            : `${item.prodIdx}:${item.dot}`;
    }

    itemsetKey(items) {
        return items.map(i => this.itemKey(i)).sort().join('|');
    }

    sameItemset(a, b) {
        if (a.length !== b.length) return false;
        return this.itemsetKey(a) === this.itemsetKey(b);
    }

    // ε-aware: si el RHS es [ε], el punto solo tiene dos posiciones (antes y después)
    nextSymbol(item) {
        const prod = this.grammar.productions[item.prodIdx];
        if (prod.rhs.length === 1 && prod.rhs[0] === Grammar.EPSILON) return null;
        if (item.dot >= prod.rhs.length) return null;
        return prod.rhs[item.dot];
    }

    isComplete(item) {
        const prod = this.grammar.productions[item.prodIdx];
        if (prod.rhs.length === 1 && prod.rhs[0] === Grammar.EPSILON) return item.dot >= 0;
        return item.dot >= prod.rhs.length;
    }

    // Subclase debe sobrescribir closure() y goto()
    closure(items) { throw new Error('not implemented'); }
    gotoSet(items, symbol) { throw new Error('not implemented'); }

    buildAutomaton() {
        // El item inicial: S' → •S [con o sin lookahead según subclase]
        const initial = this.initialItem();
        const startState = this.closure([initial]);
        this.states = [startState];
        const stateMap = new Map();
        stateMap.set(this.itemsetKey(startState), 0);
        const queue = [0];

        while (queue.length > 0) {
            const stateIdx = queue.shift();
            const state = this.states[stateIdx];
            const symbolsSeen = new Set();
            for (const item of state) {
                const sym = this.nextSymbol(item);
                if (sym && sym !== Grammar.EPSILON) symbolsSeen.add(sym);
            }
            for (const sym of symbolsSeen) {
                const newState = this.gotoSet(state, sym);
                if (newState.length === 0) continue;
                const key = this.itemsetKey(newState);
                let targetIdx;
                if (stateMap.has(key)) {
                    targetIdx = stateMap.get(key);
                } else {
                    targetIdx = this.states.length;
                    this.states.push(newState);
                    stateMap.set(key, targetIdx);
                    queue.push(targetIdx);
                }
                if (!this.transitions[stateIdx]) this.transitions[stateIdx] = {};
                this.transitions[stateIdx][sym] = targetIdx;
            }
        }
    }

    initialItem() {
        return { prodIdx: 0, dot: 0 };
    }

    buildTables() {
        // Subclase debe sobrescribir
        throw new Error('not implemented');
    }

    addAction(stateIdx, terminal, action) {
        if (!this.action[stateIdx]) this.action[stateIdx] = {};
        if (this.action[stateIdx][terminal]) {
            const existing = this.action[stateIdx][terminal];
            // Mismo accion → no conflicto
            if (existing.type === action.type && existing.value === action.value) return;
            this.conflicts.push({
                state: stateIdx,
                terminal,
                existing,
                new: action,
                type: this.conflictType(existing, action)
            });
            // mantener la primera acción
            return;
        }
        this.action[stateIdx][terminal] = action;
    }

    addGoto(stateIdx, nt, target) {
        if (!this.goto[stateIdx]) this.goto[stateIdx] = {};
        this.goto[stateIdx][nt] = target;
    }

    conflictType(a, b) {
        if ((a.type === 'shift' && b.type === 'reduce') || (a.type === 'reduce' && b.type === 'shift'))
            return 'Shift/Reduce';
        if (a.type === 'reduce' && b.type === 'reduce') return 'Reduce/Reduce';
        return 'Otro';
    }

    parse(input) {
        const tokens = this.originalGrammar.tokenize(input);
        const stack = [0];   // Stack de estados
        const symStack = []; // Stack de símbolos (para AST y display)
        const nodeStack = []; // Para AST
        const trace = [];
        let pos = 0;
        let stepNum = 0;

        if (this.conflicts.length > 0) {
            // Reportar pero permitir parseo (toma la primera acción registrada)
        }

        while (true) {
            const stateIdx = stack[stack.length - 1];
            const current = tokens[pos];
            stepNum++;
            const action = (this.action[stateIdx] || {})[current];

            const step = {
                step: stepNum,
                stack: stack.join(' '),
                symStack: symStack.join(' '),
                input: tokens.slice(pos).join(' '),
                action: ''
            };

            if (!action) {
                step.action = `✗ Error: no action[${stateIdx}, ${current}]`;
                trace.push(step);
                return {
                    success: false,
                    error: `Error sintáctico: no hay acción definida para el estado ${stateIdx} con el token '${current}'. Tokens previos: ${tokens.slice(0, pos).join(' ') || '(ninguno)'}`,
                    trace,
                    ast: null,
                    tables: this.exportTables(),
                    tokens,
                    states: this.states,
                    transitions: this.transitions
                };
            }

            if (action.type === 'accept') {
                step.action = '✓ Aceptar';
                trace.push(step);
                return {
                    success: true,
                    error: null,
                    trace,
                    ast: nodeStack[0] || null,
                    tables: this.exportTables(),
                    tokens,
                    states: this.states,
                    transitions: this.transitions
                };
            }

            if (action.type === 'shift') {
                step.action = `shift ${action.value}`;
                trace.push(step);
                stack.push(action.value);
                symStack.push(current);
                nodeStack.push({ name: current, leaf: true, token: current, children: [] });
                pos++;
            } else if (action.type === 'reduce') {
                const prod = this.grammar.productions[action.value];
                step.action = `reduce ${prod.lhs} → ${prod.rhs.join(' ')}`;
                trace.push(step);
                const isEpsilon = prod.rhs.length === 1 && prod.rhs[0] === Grammar.EPSILON;
                const popCount = isEpsilon ? 0 : prod.rhs.length;
                const children = [];
                for (let i = 0; i < popCount; i++) {
                    stack.pop();
                    symStack.pop();
                    children.unshift(nodeStack.pop());
                }
                if (isEpsilon) {
                    children.push({ name: 'ε', leaf: true, children: [] });
                }
                const newNode = { name: prod.lhs, children };
                const topState = stack[stack.length - 1];
                const gotoState = (this.goto[topState] || {})[prod.lhs];
                if (gotoState === undefined) {
                    return {
                        success: false,
                        error: `Error: no hay GOTO[${topState}, ${prod.lhs}]`,
                        trace,
                        ast: null,
                        tables: this.exportTables(),
                        tokens,
                        states: this.states,
                        transitions: this.transitions
                    };
                }
                stack.push(gotoState);
                symStack.push(prod.lhs);
                nodeStack.push(newNode);
            }

            if (stepNum > 199) {
                return {
                    success: false,
                    error: 'Demasiados pasos. Posible bucle.',
                    trace,
                    ast: null,
                    tables: this.exportTables(),
                    tokens,
                    states: this.states,
                    transitions: this.transitions
                };
            }
        }
    }

    exportTables() {
        return {
            action: this.action,
            goto: this.goto,
            states: this.states.map((s, i) => ({
                index: i,
                items: s.map(item => this.itemToString(item))
            })),
            transitions: this.transitions,
            conflicts: this.conflicts,
            productions: this.grammar.productions,
            wasAutoAugmented: this.wasAutoAugmented,
            augmentedStart: this.wasAutoAugmented ? this.grammar.startSymbol : null,
            originalStart: this.originalGrammar.startSymbol
        };
    }
}

window.LRBase = LRBase;
