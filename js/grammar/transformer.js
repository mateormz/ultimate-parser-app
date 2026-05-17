// ============================================================================
// Grammar Transformer
// - Eliminación de recursión izquierda
// - Factorización izquierda
// ============================================================================

function eliminateLeftRecursion(grammar) {
    const productionsMap = {};
    for (const nt of grammar.nonTerminals) productionsMap[nt] = [];
    for (const p of grammar.productions) productionsMap[p.lhs].push([...p.rhs]);

    const nts = [...grammar.nonTerminals];

    for (let i = 0; i < nts.length; i++) {
        const Ai = nts[i];
        // Reemplazar Aj por sus producciones (j < i)
        for (let j = 0; j < i; j++) {
            const Aj = nts[j];
            const newProds = [];
            for (const alpha of productionsMap[Ai]) {
                if (alpha.length > 0 && alpha[0] === Aj) {
                    for (const beta of productionsMap[Aj]) {
                        const expanded = [...(beta[0] === Grammar.EPSILON ? [] : beta), ...alpha.slice(1)];
                        newProds.push(expanded.length === 0 ? [Grammar.EPSILON] : expanded);
                    }
                } else {
                    newProds.push(alpha);
                }
            }
            productionsMap[Ai] = newProds;
        }

        // Eliminar recursión inmediata
        const recursive = [];
        const nonRecursive = [];
        for (const p of productionsMap[Ai]) {
            if (p.length > 0 && p[0] === Ai) recursive.push(p.slice(1));
            else nonRecursive.push(p);
        }

        if (recursive.length > 0) {
            const newNT = Ai + "'";
            productionsMap[newNT] = [];
            const newAi = [];
            for (const beta of nonRecursive) {
                if (beta.length === 1 && beta[0] === Grammar.EPSILON) {
                    newAi.push([newNT]);
                } else {
                    newAi.push([...beta, newNT]);
                }
            }
            for (const alpha of recursive) {
                productionsMap[newNT].push([...alpha, newNT]);
            }
            productionsMap[newNT].push([Grammar.EPSILON]);
            productionsMap[Ai] = newAi;
        }
    }

    // Construir texto resultante
    const lines = [];
    const order = [...nts];
    for (const nt of order) {
        if (productionsMap[nt] && productionsMap[nt].length > 0) {
            const alts = productionsMap[nt].map(rhs => rhs.join(' ') || Grammar.EPSILON).join(' | ');
            lines.push(`${nt} -> ${alts}`);
        }
    }
    // Añadir las primas
    for (const nt of Object.keys(productionsMap)) {
        if (!order.includes(nt)) {
            const alts = productionsMap[nt].map(rhs => rhs.join(' ') || Grammar.EPSILON).join(' | ');
            lines.push(`${nt} -> ${alts}`);
        }
    }
    return lines.join('\n');
}

function leftFactor(grammar) {
    const productionsMap = {};
    for (const nt of grammar.nonTerminals) productionsMap[nt] = [];
    for (const p of grammar.productions) productionsMap[p.lhs].push([...p.rhs]);

    let changed = true;
    let primeCounter = 1;
    while (changed) {
        changed = false;
        const ntList = Object.keys(productionsMap);
        for (const nt of ntList) {
            const prods = productionsMap[nt];
            // Agrupar por primer símbolo
            const groups = {};
            for (const p of prods) {
                const first = (p[0] === Grammar.EPSILON) ? '__eps__' : p[0];
                if (!groups[first]) groups[first] = [];
                groups[first].push(p);
            }
            const conflictKey = Object.keys(groups).find(k => groups[k].length > 1 && k !== '__eps__');
            if (conflictKey) {
                changed = true;
                // Encontrar el prefijo común más largo
                const conflictGroup = groups[conflictKey];
                let prefix = [...conflictGroup[0]];
                for (let i = 1; i < conflictGroup.length; i++) {
                    let k = 0;
                    while (k < prefix.length && k < conflictGroup[i].length && prefix[k] === conflictGroup[i][k]) k++;
                    prefix = prefix.slice(0, k);
                }
                const newNT = nt + "''".slice(0, primeCounter % 3 + 1) + (primeCounter > 3 ? primeCounter : '');
                primeCounter++;
                productionsMap[newNT] = [];
                for (const p of conflictGroup) {
                    const suffix = p.slice(prefix.length);
                    productionsMap[newNT].push(suffix.length === 0 ? [Grammar.EPSILON] : suffix);
                }
                // Quitar conflictGroup de prods y añadir nueva
                const remaining = prods.filter(p => !conflictGroup.includes(p));
                remaining.push([...prefix, newNT]);
                productionsMap[nt] = remaining;
                break;
            }
        }
    }

    const lines = [];
    for (const nt of Object.keys(productionsMap)) {
        const alts = productionsMap[nt].map(rhs => rhs.join(' ') || Grammar.EPSILON).join(' | ');
        lines.push(`${nt} -> ${alts}`);
    }
    return lines.join('\n');
}

window.GrammarTransformer = { eliminateLeftRecursion, leftFactor };
