// ============================================================================
// Main App Logic
// Orquesta UI, parsers, visualizaciones y exploración paso a paso
// ============================================================================

const PARSER_INFO = {
    'recursive-descent': {
        name: 'Descenso Recursivo',
        family: 'Top-Down',
        tag: 'RD',
        complexity: 'O(n)',
        lookahead: '1',
        notes: 'No tolera recursión izquierda. Requiere gramática factorizada.',
        class: 'RecursiveDescentParser'
    },
    'll1': {
        name: 'LL(1) Predictivo',
        family: 'Top-Down',
        tag: 'LL(1)',
        complexity: 'O(n)',
        lookahead: '1',
        notes: 'Construye tabla M[A,a]. Sin recursión izquierda, sin ambigüedad.',
        class: 'LL1Parser'
    },
    'lr0': {
        name: 'LR(0)',
        family: 'Bottom-Up',
        tag: 'LR(0)',
        complexity: 'O(n)',
        lookahead: '0',
        notes: 'Sin lookahead. Reduce sin mirar siguiente token — frecuentes conflictos.',
        class: 'LR0Parser'
    },
    'slr1': {
        name: 'SLR(1)',
        family: 'Bottom-Up',
        tag: 'SLR(1)',
        complexity: 'O(n)',
        lookahead: '1 (FOLLOW)',
        notes: 'LR(0) + FOLLOW. Más potente que LR(0), simple de construir.',
        class: 'SLR1Parser'
    },
    'lalr1': {
        name: 'LALR(1)',
        family: 'Bottom-Up',
        tag: 'LALR(1)',
        complexity: 'O(n)',
        lookahead: '1',
        notes: 'Como LR(1) pero con estados fusionados. Usado por yacc/bison.',
        class: 'LALR1Parser'
    },
    'lr1': {
        name: 'LR(1) Canónico',
        family: 'Bottom-Up',
        tag: 'LR(1)',
        complexity: 'O(n)',
        lookahead: '1',
        notes: 'El más potente de los LR(1). Tablas grandes (muchos estados).',
        class: 'LR1Parser'
    }
};

const EXAMPLE_GRAMMARS = {
    'arith-ll1': {
        name: 'Aritmética LL(1) (factorizada)',
        grammar: `E -> T E'
E' -> + T E' | ε
T -> F T'
T' -> * F T' | ε
F -> ( E ) | id`,
        input: 'id + id * id',
        recommended: 'll1'
    },
    'arith-lr': {
        name: 'Aritmética LR (con recursión izq.)',
        grammar: `E -> E + T | T
T -> T * F | F
F -> ( E ) | id`,
        input: 'id + id * id',
        recommended: 'slr1'
    },
    'simple-list': {
        name: 'Lista de elementos',
        grammar: `L -> L , a | a`,
        input: 'a , a , a',
        recommended: 'slr1'
    },
    'if-else': {
        name: 'If-Else (ambigua → conflictos)',
        grammar: `S -> i E t S | i E t S e S | a
E -> b`,
        input: 'i b t i b t a e a',
        recommended: 'lr1'
    },
    'parentheses': {
        name: 'Paréntesis balanceados',
        grammar: `S -> ( S ) | S S | ε`,
        input: '( ( ) ( ) )',
        recommended: 'lr1'
    },
    'cs3402': {
        name: 'CS3402 — Calculadora simple',
        grammar: `Program -> Stmt
Stmt -> print ( Args )
Args -> Args , Exp | Exp
Exp -> Exp + Term | Exp - Term | Term
Term -> Term * Factor | Term / Factor | Factor
Factor -> ( Exp ) | id | num`,
        input: 'print ( id + num * id )',
        recommended: 'lalr1'
    }
};

// ============================================================================
// Zoom configuration
// ============================================================================
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1.4;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8.0;

// ============================================================================
// State
// ============================================================================
const state = {
    grammar: null,
    currentParser: 'll1',
    parserInstance: null,
    result: null,
    currentStep: 0,
    activeTab: 'parse-tree',
    automatonExpanded: false,
    aiSuggestedGrammar: '',
    zoom: {
        ast: { scale: ZOOM_DEFAULT, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 },
        realAst: { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 },
        automaton: { scale: ZOOM_DEFAULT, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 },
    },
};

// ============================================================================
// DOM utils
// ============================================================================
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function setText(sel, txt) {
    const el = $(sel);
    if (el) el.textContent = txt;
}

function setHTML(sel, html) {
    const el = $(sel);
    if (el) el.innerHTML = html;
}

function parseTreeHasArithmeticOperator(parseTree) {
    const operators = new Set(['+', '-', '*', '/', '**', '^']);

    function visit(node) {
        if (!node) return false;
        const children = node.children || [];
        if (node.leaf || children.length === 0) {
            return operators.has(node.token || node.name);
        }
        return children.some(visit);
    }

    return visit(parseTree);
}

function renderAstUnavailableMessage(message) {
    $('#realAst-container').innerHTML = `<div class="zoom-content"><div class="info-card ast-info-card">${message}</div></div>`;
    applyPanZoom('realAst');
}

// Mermaid (cargado en HTML)
function renderMermaid(targetSel, code) {
    const el = $(targetSel);
    if (!el) return;
    const target = el.id.replace('-container', '');
    el.innerHTML = `<div class="zoom-content"><div class="mermaid">${code}</div></div>`;
    if (window.mermaid) {
        const id = 'mermaid-' + Date.now();
        try {
            window.mermaid.render(id, code).then(({ svg }) => {
                ensureZoomContent(el).innerHTML = svg;
                requestAnimationFrame(() => resetPanZoom(target));
            }).catch(err => {
                el.innerHTML = `<div class="zoom-content"><div class="error-card"><h4>Error renderizando diagrama</h4><p>${err.message}</p></div></div>`;
                requestAnimationFrame(() => resetPanZoom(target));
            });
        } catch (e) {
            el.innerHTML = `<div class="zoom-content"><div class="error-card"><h4>Error renderizando diagrama</h4><p>${e.message}</p></div></div>`;
            requestAnimationFrame(() => resetPanZoom(target));
        }
    }
}

function changeDiagramZoom(target, action) {
    if (!state.zoom[target]) resetPanZoom(target);
    if (action === 'zoom-in') zoomAtCenter(target, 1 + ZOOM_STEP);
    else if (action === 'zoom-out') zoomAtCenter(target, 1 - ZOOM_STEP);
    else if (action === 'zoom-reset') resetPanZoom(target);
}

function updateDiagramZoomDisplay(target) {
    const label = $(`#${target}-zoom-value`);
    if (!label) return;
    const value = state.zoom[target]?.scale || 1;
    label.textContent = `${Math.round(value * 100)}%`;
}

function setupZoomControls() {
    $$('.zoom-btn').forEach(btn => {
        if (!btn.dataset.target || !btn.dataset.action) return;
        btn.addEventListener('click', () => changeDiagramZoom(btn.dataset.target, btn.dataset.action));
    });
    setupPanZoomFor('ast');
    setupPanZoomFor('realAst');
    setupPanZoomFor('automaton');
}

function setupPanZoomFor(target) {
    const container = $(`#${target}-container`);
    if (!container) return;
    container.addEventListener('wheel', (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
        zoomAtPoint(target, factor, event.clientX, event.clientY);
    }, { passive: false });
    container.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        const zoomState = getPanZoomState(target);
        zoomState.isDragging = true;
        zoomState.startX = event.clientX - zoomState.x;
        zoomState.startY = event.clientY - zoomState.y;
        container.classList.add('dragging');
        event.preventDefault();
    });
    document.addEventListener('mousemove', (event) => {
        const zoomState = getPanZoomState(target);
        if (!zoomState.isDragging) return;
        zoomState.x = event.clientX - zoomState.startX;
        zoomState.y = event.clientY - zoomState.startY;
        applyPanZoom(target);
    });
    document.addEventListener('mouseup', () => {
        const zoomState = getPanZoomState(target);
        if (!zoomState.isDragging) return;
        zoomState.isDragging = false;
        container.classList.remove('dragging');
    });
}

function applyPanZoom(target) {
    const container = $(`#${target}-container`);
    if (!container) return;
    const content = ensureZoomContent(container);
    const zoomState = getPanZoomState(target);
    content.style.transform = `translate(${zoomState.x}px, ${zoomState.y}px) scale(${zoomState.scale})`;
    updateDiagramZoomDisplay(target);
}

function zoomAtCenter(target, factor) {
    const container = $(`#${target}-container`);
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAtPoint(target, factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function resetPanZoom(target) {
    const defaultScale = getDefaultZoomScale(target);
    const centered = getCenteredPanZoom(target, defaultScale);
    state.zoom[target] = { scale: defaultScale, x: centered.x, y: centered.y, isDragging: false, startX: 0, startY: 0 };
    const container = $(`#${target}-container`);
    if (container) container.classList.remove('dragging');
    applyPanZoom(target);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function zoomAtPoint(target, factor, clientX, clientY) {
    const container = $(`#${target}-container`);
    if (!container) return;
    const zoomState = getPanZoomState(target);
    const oldScale = zoomState.scale;
    const newScale = Number(clamp(oldScale * factor, ZOOM_MIN, ZOOM_MAX).toFixed(3));
    if (newScale === oldScale) return;

    const rect = container.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    zoomState.x = pointX - ((pointX - zoomState.x) / oldScale) * newScale;
    zoomState.y = pointY - ((pointY - zoomState.y) / oldScale) * newScale;
    zoomState.scale = newScale;
    applyPanZoom(target);
}

function getPanZoomState(target) {
    if (!state.zoom[target] || typeof state.zoom[target] === 'number') {
        const scale = state.zoom[target] || getDefaultZoomScale(target);
        const centered = getCenteredPanZoom(target, scale);
        state.zoom[target] = { scale, x: centered.x, y: centered.y, isDragging: false, startX: 0, startY: 0 };
    }
    return state.zoom[target];
}

function getDefaultZoomScale(target) {
    return target === 'realAst' ? 1 : ZOOM_DEFAULT;
}

function getCenteredPanZoom(target, scale = 1) {
    const container = $(`#${target}-container`);
    if (!container) return { x: 0, y: 0 };
    const content = ensureZoomContent(container);
    const contentWidth = content.offsetWidth * scale;
    const contentHeight = content.offsetHeight * scale;
    return {
        x: (container.clientWidth - contentWidth) / 2,
        y: (container.clientHeight - contentHeight) / 2,
    };
}

function ensureZoomContent(container) {
    let content = container.querySelector('.zoom-content');
    if (!content) {
        content = document.createElement('div');
        content.className = 'zoom-content';
        while (container.firstChild) content.appendChild(container.firstChild);
        container.appendChild(content);
    }
    return content;
}

// ============================================================================
// Init
// ============================================================================
function init() {
    // Cargar ejemplo inicial
    selectExample('arith-ll1');
    // Wire up event listeners
    $('#parse-btn').addEventListener('click', runParse);
    $('#analyze-btn').addEventListener('click', analyzeGrammar);
    $('#example-select').addEventListener('change', e => selectExample(e.target.value));
    $('#fix-leftrec-btn').addEventListener('click', fixLeftRecursion);
    $('#fix-factor-btn').addEventListener('click', factorGrammar);
    $$('.parser-option').forEach(btn => {
        btn.addEventListener('click', () => selectParser(btn.dataset.parser));
    });
    $$('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    $('#step-first').addEventListener('click', () => goToStep(0));
    $('#step-prev').addEventListener('click', () => goToStep(state.currentStep - 1));
    $('#step-next').addEventListener('click', () => goToStep(state.currentStep + 1));
    $('#step-last').addEventListener('click', () => goToStep(state.result?.trace?.length - 1 || 0));
    $('#step-play').addEventListener('click', autoPlay);
    $('#toggle-automaton-view-btn')?.addEventListener('click', toggleAutomatonView);
    $('#ask-ai-btn')?.addEventListener('click', askGrammarAI);
    setupZoomControls();

    // Teclado virtual
    $$('.virtual-key').forEach(key => {
        key.addEventListener('click', () => insertSymbol(key.dataset.symbol));
    });

    // Inicialmente seleccionar parser LL(1)
    selectParser('ll1');
    updateAutomatonViewButton();
    applyPanZoom('ast');
    applyPanZoom('realAst');
    applyPanZoom('automaton');
}

function selectExample(key) {
    const ex = EXAMPLE_GRAMMARS[key];
    if (!ex) return;
    $('#grammar-input').value = ex.grammar;
    $('#string-input').value = ex.input;
    if (ex.recommended) selectParser(ex.recommended);
    setText('#status-text', `Ejemplo cargado: ${ex.name}`);
    $('#example-select').value = key;
}

function selectParser(key) {
    state.currentParser = key;
    $$('.parser-option').forEach(b => b.classList.toggle('active', b.dataset.parser === key));
    const info = PARSER_INFO[key];
    setText('#current-parser-name', info.name);
    setText('#current-parser-family', info.family);
    setText('#current-parser-complexity', info.complexity);
    setText('#current-parser-lookahead', info.lookahead);
    setText('#current-parser-notes', info.notes);
}

function insertSymbol(sym) {
    const focused = document.activeElement;
    if (focused && (focused.id === 'grammar-input' || focused.id === 'string-input')) {
        const start = focused.selectionStart;
        const end = focused.selectionEnd;
        focused.value = focused.value.substring(0, start) + sym + focused.value.substring(end);
        focused.selectionStart = focused.selectionEnd = start + sym.length;
        focused.focus();
    } else {
        // Por defecto, insertar en grammar
        const target = $('#grammar-input');
        target.value += sym;
        target.focus();
    }
}

// ============================================================================
// Análisis de gramática (sin parsear cadena)
// ============================================================================
function analyzeGrammar() {
    const text = $('#grammar-input').value;
    try {
        const g = new Grammar(text);
        state.grammar = g;

        const isLL1 = g.isLL1();
        const hasLR = g.hasLeftRecursion();
        const needsFactor = g.needsLeftFactoring();
        const leftRec = g.findLeftRecursive();

        let html = `<div class="analysis-grid">`;
        html += `<div class="analysis-card"><h5>Símbolo Inicial</h5><div class="value">${g.startSymbol}</div></div>`;
        html += `<div class="analysis-card"><h5>No Terminales (${g.nonTerminals.size})</h5><div class="value">${[...g.nonTerminals].join(', ')}</div></div>`;
        html += `<div class="analysis-card"><h5>Terminales (${g.terminals.size})</h5><div class="value">${[...g.terminals].join(', ')}</div></div>`;
        html += `<div class="analysis-card"><h5>Producciones</h5><div class="value">${g.productions.length}</div></div>`;
        html += `<div class="analysis-card ${isLL1 ? 'ok' : 'warning'}"><h5>¿Es LL(1)?</h5><div class="value">${isLL1 ? '✓ Sí' : '✗ No — hay conflictos'}</div></div>`;
        html += `<div class="analysis-card ${hasLR ? 'warning' : 'ok'}"><h5>Recursión izquierda</h5><div class="value">${hasLR ? '⚠ Sí: ' + leftRec.join(', ') : '✓ Ninguna'}</div></div>`;
        html += `<div class="analysis-card ${needsFactor ? 'warning' : 'ok'}"><h5>Factorización izq.</h5><div class="value">${needsFactor ? '⚠ Necesaria' : '✓ No necesaria'}</div></div>`;
        html += `</div>`;

        // FIRST y FOLLOW
        html += `<h4 style="font-family: var(--font-display); font-size: 22px; margin: 24px 0 12px;">FIRST sets</h4>`;
        html += `<table class="parser-table"><thead><tr><th>No-Terminal</th><th>FIRST</th></tr></thead><tbody>`;
        for (const nt of g.nonTerminals) {
            html += `<tr><td>${nt}</td><td>${GrammarUtils.setToString(g.first[nt])}</td></tr>`;
        }
        html += `</tbody></table>`;

        html += `<h4 style="font-family: var(--font-display); font-size: 22px; margin: 24px 0 12px;">FOLLOW sets</h4>`;
        html += `<table class="parser-table"><thead><tr><th>No-Terminal</th><th>FOLLOW</th></tr></thead><tbody>`;
        for (const nt of g.nonTerminals) {
            html += `<tr><td>${nt}</td><td>${GrammarUtils.setToString(g.follow[nt])}</td></tr>`;
        }
        html += `</tbody></table>`;

        // Producciones
        html += `<h4 style="font-family: var(--font-display); font-size: 22px; margin: 24px 0 12px;">Producciones</h4>`;
        html += `<div class="production-list">`;
        g.productions.forEach((p, i) => {
            html += `<div class="prod-item"><span class="prod-num">(${i})</span> ${GrammarUtils.prodToString(p)}</div>`;
        });
        html += `</div>`;

        $('#analysis-panel').innerHTML = html;
        switchTab('analysis');

        setStatus('success', 'Análisis completo', `${g.productions.length} producciones`);

    } catch (e) {
        $('#analysis-panel').innerHTML = `<div class="error-card"><h4>Error en la gramática</h4><p>${e.message}</p></div>`;
        switchTab('analysis');
        setStatus('error', 'Error de gramática', e.message);
    }
}

// ============================================================================
// Transformaciones
// ============================================================================
function fixLeftRecursion() {
    const text = $('#grammar-input').value;
    try {
        const g = new Grammar(text);
        if (!g.hasLeftRecursion()) {
            alert('La gramática no tiene recursión izquierda directa.');
            return;
        }
        const newText = GrammarTransformer.eliminateLeftRecursion(g);
        $('#grammar-input').value = newText;
        setStatus('success', 'Recursión eliminada', 'Gramática transformada');
    } catch (e) {
        setStatus('error', 'Error transformando', e.message);
    }
}

function factorGrammar() {
    const text = $('#grammar-input').value;
    try {
        const g = new Grammar(text);
        const newText = GrammarTransformer.leftFactor(g);
        $('#grammar-input').value = newText;
        setStatus('success', 'Gramática factorizada', '');
    } catch (e) {
        setStatus('error', 'Error factorizando', e.message);
    }
}

// ============================================================================
// Ejecutar parse
// ============================================================================
function runParse() {
    const grammarText = $('#grammar-input').value;
    const input = $('#string-input').value;
    const parserKey = state.currentParser;

    setStatus('processing', 'Parseando...', '');

    try {
        const g = new Grammar(grammarText);
        state.grammar = g;
        const info = PARSER_INFO[parserKey];
        const ParserCls = window[info.class];
        const parser = new ParserCls(g);
        state.parserInstance = parser;
        const result = parser.parse(input);
        state.result = result;
        state.currentStep = 0;

        renderResults();

        if (result.success) {
            setStatus('success', '✓ Cadena aceptada', `${result.trace.length} pasos`);
        } else {
            setStatus('error', '✗ Cadena rechazada', result.error.substring(0, 80) + (result.error.length > 80 ? '…' : ''));
        }
    } catch (e) {
        setStatus('error', 'Error', e.message);
        $('#analysis-panel').innerHTML = `<div class="error-card"><h4>Error</h4><p>${e.message}</p></div>`;
        switchTab('analysis');
    }
}

function setStatus(cls, text, detail) {
    const bar = $('#status-bar');
    bar.className = 'status-bar ' + cls;
    setText('#status-text', text);
    setText('#status-detail', detail || '');
}

// ============================================================================
// Renderizar resultados
// ============================================================================
function renderResults() {
    const r = state.result;
    if (!r) return;
    state.automatonExpanded = false;
    updateAutomatonViewButton();
    resetPanZoom('ast');
    resetPanZoom('realAst');
    resetPanZoom('automaton');

    // Result Summary
    let summary = '';
    if (r.success) {
        summary = `<div class="success-card"><div class="icon">✓</div><div class="text"><h4>Cadena aceptada</h4><p>${state.parserInstance.constructor.name} procesó ${r.tokens.length - 1} tokens en ${r.trace.length} pasos.</p></div></div>`;
    } else {
        summary = `<div class="error-card"><h4>Cadena rechazada</h4><p>${r.error}</p><div class="hint"><strong>💡 Sugerencia:</strong> ${suggestErrorFix(r.error)}</div></div>`;
    }
    $('#result-summary').innerHTML = summary;

    // Parse Tree y AST real
    if (r.ast) {
        const parseTreeCode = Visualizers.astToMermaid(r.ast);
        renderMermaid('#ast-container', parseTreeCode);

        if (parseTreeHasArithmeticOperator(r.ast)) {
            const realAst = Visualizers.parseTreeToAst(r.ast);
            if (realAst) {
                const realAstCode = Visualizers.astToMermaid(realAst);
                renderMermaid('#realAst-container', realAstCode);
            } else {
                renderAstUnavailableMessage('No se pudo construir un AST aritmético para esta cadena. Revisa la pestaña Parse Tree.');
            }
        } else {
            renderAstUnavailableMessage('AST no disponible: el Parse Tree no contiene operadores aritméticos reconocidos (+, -, *, /, **, ^).');
        }
    } else {
        $('#ast-container').innerHTML = '<div class="zoom-content"><p style="color: var(--ink-faded); text-align: center; padding: 40px; font-family: var(--font-mono);">No hay AST disponible (parseo falló)</p></div>';
        $('#realAst-container').innerHTML = '<div class="zoom-content"><p style="color: var(--ink-faded); text-align: center; padding: 40px; font-family: var(--font-mono);">No hay AST disponible porque el parseo fallÃ³.</p></div>';
        applyPanZoom('ast');
    }

    // Trace step-by-step
    renderTrace();

    // Tables
    renderTables();

    // Conflicts
    renderConflicts();

    // Automaton (solo para LR)
    renderAutomaton();

    // Cambiar a la primera pestaña visible útil
    if (r.success) switchTab('parse-tree');
    else switchTab('trace');

    // Actualizar contador
    state.currentStep = 0;
    updateStepDisplay();
}

function suggestErrorFix(error) {
    if (!error) return '';
    const e = error.toLowerCase();
    if (e.includes('recursión izquierda')) {
        return 'Usa el botón "Eliminar Recursión Izq." en el panel lateral para transformar la gramática automáticamente, o cambia a un parser bottom-up (LR).';
    }
    if (e.includes('no es ll(1)')) {
        return 'Tu gramática tiene conflictos LL(1). Mira la pestaña "Tabla" para ver los conflictos. Considera factorizar a la izquierda o cambiar a un parser LR.';
    }
    if (e.includes('no hay acción')) {
        return 'El parser no sabe qué hacer con este token en el estado actual. Revisa que tu cadena sea válida según la gramática, o que la gramática genere las construcciones que necesitas.';
    }
    if (e.includes('se esperaba')) {
        return 'Hay un token inesperado. Revisa que tu cadena sea válida según la gramática y que los espacios separen correctamente los tokens.';
    }
    if (e.includes('m[')) {
        return 'No hay entrada en la tabla LL(1) para esa combinación. Esto sucede cuando el siguiente token no puede iniciar ninguna producción para el no-terminal en cima de pila.';
    }
    return 'Revisa la gramática y la cadena de entrada. Asegúrate de que los tokens estén separados por espacios y que la cadena sea válida.';
}

function renderTrace() {
    const r = state.result;
    if (!r || !r.trace || r.trace.length === 0) {
        $('#trace-list').innerHTML = '<p style="color: var(--ink-faded); padding: 12px; font-family: var(--font-mono);">Sin pasos para mostrar</p>';
        return;
    }
    let html = '';
    r.trace.forEach((step, i) => {
        const isCurrent = i === state.currentStep;
        let display = '';
        if (step.step !== undefined) {
            display = `<strong>Stack:</strong> ${step.stack || step.symStack || '∅'} &nbsp; <strong>→</strong> ${step.input || ''} &nbsp; <em>${step.action}</em>`;
        } else {
            display = step.message || '';
        }
        html += `<div class="trace-item ${isCurrent ? 'current' : ''}" data-step="${i}">
            <span class="step-num">${i + 1}</span>
            <span>${display}</span>
        </div>`;
    });
    $('#trace-list').innerHTML = html;

    // Click handlers
    $$('#trace-list .trace-item').forEach(el => {
        el.addEventListener('click', () => goToStep(parseInt(el.dataset.step)));
    });

    setText('#trace-total', r.trace.length);
}

function renderTables() {
    const r = state.result;
    let html = '';

    if (r.tables && r.tables.ll1) {
        html += '<h4 style="font-family: var(--font-display); font-size: 22px; margin-bottom: 12px;">Tabla LL(1) — M[A, a]</h4>';
        html += renderLL1Table(r.tables.ll1);
    }
    if (r.tables && r.tables.action) {
        html += '<h4 style="font-family: var(--font-display); font-size: 22px; margin: 20px 0 12px;">Tabla ACTION & GOTO</h4>';
        html += renderLRTable(r.tables);
        html += '<h4 style="font-family: var(--font-display); font-size: 22px; margin: 24px 0 12px;">Estados LR (Itemsets)</h4>';
        html += renderStates(r.tables.states);
    }
    if (!html) {
        html = '<p style="color: var(--ink-faded); padding: 12px; font-family: var(--font-mono);">No hay tablas para mostrar (descenso recursivo no genera tablas).</p>';
    }
    $('#tables-container').innerHTML = html;
}

function renderLL1Table(table) {
    if (!table || !state.grammar) return '';
    const g = state.grammar;
    const terminals = [...g.terminals, Grammar.END_MARKER];
    let html = '<div class="table-wrap"><table class="parser-table"><thead><tr><th>No-Term \\ Term</th>';
    for (const t of terminals) html += `<th>${t}</th>`;
    html += '</tr></thead><tbody>';
    for (const nt of g.nonTerminals) {
        html += `<tr><td>${nt}</td>`;
        for (const t of terminals) {
            const prod = (table[nt] || {})[t];
            if (prod) {
                html += `<td>${nt} → ${prod.rhs.join(' ')}</td>`;
            } else {
                html += `<td></td>`;
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function renderLRTable(tables) {
    const g = state.grammar;
    const augGrammar = state.parserInstance.grammar;
    const terminals = [...new Set([...augGrammar.terminals, Grammar.END_MARKER])];
    const ntList = [...augGrammar.nonTerminals].filter(n => n !== augGrammar.startSymbol);

    let html = '<div class="table-wrap"><table class="parser-table"><thead><tr><th rowspan="2">Estado</th>';
    html += `<th colspan="${terminals.length}" style="text-align:center;">ACTION</th>`;
    html += `<th colspan="${ntList.length}" style="text-align:center;">GOTO</th></tr><tr>`;
    for (const t of terminals) html += `<th>${t}</th>`;
    for (const nt of ntList) html += `<th>${nt}</th>`;
    html += '</tr></thead><tbody>';

    for (let i = 0; i < tables.states.length; i++) {
        html += `<tr><td>${i}</td>`;
        for (const t of terminals) {
            const a = (tables.action[i] || {})[t];
            if (a) {
                let cls = '';
                let display = '';
                if (a.type === 'shift') { cls = 'shift'; display = 's' + a.value; }
                else if (a.type === 'reduce') { cls = 'reduce'; display = 'r' + a.value; }
                else if (a.type === 'accept') { cls = 'accept'; display = 'acc'; }
                html += `<td class="${cls}">${display}</td>`;
            } else html += '<td></td>';
        }
        for (const nt of ntList) {
            const g_ = (tables.goto[i] || {})[nt];
            html += g_ !== undefined ? `<td class="goto">${g_}</td>` : '<td></td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';

    // Leyenda
    html += `<p style="margin-top:8px; font-family: var(--font-mono); font-size: 12px; color: var(--ink-faded);">
        <span style="color: var(--accent-dark); font-weight:600;">sN</span> = shift al estado N &nbsp;|&nbsp;
        <span style="color: var(--circuit-dark); font-weight:600;">rN</span> = reduce con producción N &nbsp;|&nbsp;
        <span style="color: var(--circuit-dark); font-weight:600;">acc</span> = aceptar &nbsp;|&nbsp;
        <span style="color: #6b21a8; font-weight:600;">N</span> = GOTO al estado N
    </p>`;

    // Producciones (numeradas para referencia)
    html += '<h5 style="margin-top:20px; font-family: var(--font-mono); font-size:11px; text-transform:uppercase; color: var(--ink-faded); letter-spacing:0.1em;">Producciones</h5>';
    html += '<div class="production-list">';
    tables.productions.forEach((p, i) => {
        html += `<div class="prod-item"><span class="prod-num">(${i})</span> ${p.lhs} → ${p.rhs.join(' ')}</div>`;
    });
    html += '</div>';

    return html;
}

function renderStates(states) {
    if (!states) return '';
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">';
    for (const s of states) {
        html += `<div class="analysis-card"><h5>I<sub>${s.index}</sub></h5>`;
        html += '<div style="font-family: var(--font-mono); font-size: 12px; color: var(--ink-soft); line-height:1.6;">';
        for (const item of s.items) {
            html += item + '<br>';
        }
        html += '</div></div>';
    }
    html += '</div>';
    return html;
}

function renderConflicts() {
    const r = state.result;
    const list = [];
    if (r.tables && r.tables.conflicts) list.push(...r.tables.conflicts);
    if (state.parserInstance && state.parserInstance.conflicts) {
        // ya están en tables, pero por si acaso
    }

    if (list.length === 0) {
        $('#conflicts-container').innerHTML = '<p style="color: var(--circuit-dark); padding: 16px; background: var(--circuit-soft); border:2px solid var(--circuit); font-family: var(--font-mono);">✓ No hay conflictos. La gramática es compatible con este parser.</p>';
        $('#tab-conflicts .tab-badge').style.display = 'none';
        return;
    }

    $('#tab-conflicts .tab-badge').style.display = 'inline-block';
    $('#tab-conflicts .tab-badge').textContent = list.length;

    let html = `<p style="margin-bottom: 12px; color: var(--ink-soft);">Se detectaron <strong>${list.length} conflictos</strong> en la construcción de la tabla:</p>`;
    list.forEach((c, i) => {
        if (c.nonTerminal) {
            // LL(1) conflict
            html += `<div class="conflict-alert">
                <strong>${c.type}</strong> en M[${c.nonTerminal}, ${c.terminal}]<br>
                Existente: ${c.existing.lhs} → ${c.existing.rhs.join(' ')}<br>
                Nueva: ${c.new.lhs} → ${c.new.rhs.join(' ')}
            </div>`;
        } else {
            // LR conflict
            html += `<div class="conflict-alert">
                <strong>${c.type}</strong> en estado ${c.state}, terminal '${c.terminal}'<br>
                Existente: ${c.existing.type} ${c.existing.value !== undefined ? c.existing.value : ''}<br>
                Nueva: ${c.new.type} ${c.new.value !== undefined ? c.new.value : ''}
            </div>`;
        }
    });
    $('#conflicts-container').innerHTML = html;
}

function renderAutomaton() {
    const r = state.result;
    if (!r.states || !r.transitions) {
        $('#automaton-container').innerHTML = '<div class="zoom-content"><p style="color: var(--ink-faded); padding: 12px; font-family: var(--font-mono);">El autómata solo está disponible para parsers LR.</p></div>';
        applyPanZoom('automaton');
        updateAutomatonViewButton();
        return;
    }
    updateAutomatonViewButton();
    const mermaidCode = Visualizers.automatonToMermaid(
        r.states,
        r.transitions,
        state.parserInstance,
        { expanded: state.automatonExpanded }
    );
    renderMermaid('#automaton-container', mermaidCode);
}

function toggleAutomatonView() {
    state.automatonExpanded = !state.automatonExpanded;
    updateAutomatonViewButton();
    if (state.result) renderAutomaton();
}

function updateAutomatonViewButton() {
    const btn = $('#toggle-automaton-view-btn');
    if (!btn) return;
    btn.textContent = state.automatonExpanded ? 'Vista compacta' : 'Vista expandida';
}

async function askGrammarAI() {
    const responseEl = $('#ai-response');
    if (!responseEl) return;

    const grammarText = $('#grammar-input')?.value || '';
    const input = $('#string-input')?.value || '';
    let grammar = state.grammar;

    try {
        grammar = grammar || new Grammar(grammarText);
    } catch (e) {
        responseEl.innerHTML = `<div class="error-card"><h4>Gramática inválida</h4><p>${escapeHTML(e.message)}</p></div>`;
        return;
    }

    responseEl.innerHTML = '<div class="info-card">Consultando IA...</div>';
    switchTab('ai');

    const conflicts = [];
    if (state.result?.tables?.conflicts) conflicts.push(...state.result.tables.conflicts);
    if (state.parserInstance?.conflicts) conflicts.push(...state.parserInstance.conflicts);

    const payload = {
        grammar: grammarText,
        input,
        parser: state.currentParser,
        success: state.result?.success ?? null,
        error: state.result?.error || null,
        conflicts,
        first: serializeSets(grammar.first),
        follow: serializeSets(grammar.follow),
    };

    try {
        const res = await fetch('/api/grammar-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (data.rateLimit) console.log('GitHub Models rate limit:', data.rateLimit);
            throw new Error(data.detail || data.error || `HTTP ${res.status}`);
        }

        console.log('GitHub Models rate limit:', data.rateLimit);
        state.aiSuggestedGrammar = extractSuggestedGrammar(data.answer || '');
        responseEl.innerHTML = `
            <div class="ai-answer">${renderMarkdown(data.answer || 'Sin respuesta.')}</div>
            ${state.aiSuggestedGrammar ? '<button id="apply-suggested-grammar-btn" class="btn-secondary-sm ai-apply-btn">Aplicar gramática sugerida</button>' : ''}
        `;
        $('#apply-suggested-grammar-btn')?.addEventListener('click', applySuggestedGrammar);
    } catch (e) {
        responseEl.innerHTML = `<div class="error-card"><h4>No se pudo consultar la IA</h4><p>${escapeHTML(e.message)}</p></div>`;
    }
}

function serializeSets(sets) {
    const out = {};
    if (!sets) return out;
    for (const [key, value] of Object.entries(sets)) {
        out[key] = Array.isArray(value) ? value : [...value];
    }
    return out;
}

function extractSuggestedGrammar(markdown) {
    const match = String(markdown).match(/```suggested-grammar\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : '';
}

function applySuggestedGrammar() {
    if (!state.aiSuggestedGrammar) return;
    const input = $('#grammar-input');
    const responseEl = $('#ai-response');
    if (!input || !responseEl) return;

    input.value = state.aiSuggestedGrammar;
    responseEl.insertAdjacentHTML('afterbegin', '<div class="success-card ai-applied-message"><div class="text"><h4>Gramática sugerida aplicada.</h4></div></div>');
    analyzeGrammar();
    switchTab('ai');
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMarkdown(markdown) {
    if (window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(markdown));
    }
    if (window.marked) {
        return window.marked.parse(markdown);
    }
    return escapeHTML(markdown).replace(/\n/g, '<br>');
}

// ============================================================================
// Step navigation
// ============================================================================
function goToStep(idx) {
    if (!state.result || !state.result.trace) return;
    idx = Math.max(0, Math.min(idx, state.result.trace.length - 1));
    state.currentStep = idx;
    updateStepDisplay();
}

function updateStepDisplay() {
    const r = state.result;
    if (!r || !r.trace || r.trace.length === 0) {
        $('#current-step-card').innerHTML = '<p style="color: var(--ink-faded); padding: 12px; font-family: var(--font-mono);">No hay pasos para mostrar</p>';
        setText('#step-counter', '0 / 0');
        return;
    }
    const step = r.trace[state.currentStep];
    let html = `<h4>Paso ${state.currentStep + 1} de ${r.trace.length}</h4>`;
    if (step.stack !== undefined || step.symStack !== undefined) {
        html += `<div class="trace-row"><strong>Stack:</strong> <code>${step.symStack || step.stack || '∅'}</code></div>`;
        if (step.stack !== undefined && step.symStack !== undefined && step.symStack !== step.stack) {
            html += `<div class="trace-row"><strong>Estados:</strong> <code>${step.stack}</code></div>`;
        }
        html += `<div class="trace-row"><strong>Entrada:</strong> <code>${step.input || '∅'}</code></div>`;
        html += `<div class="trace-row"><strong>Acción:</strong> <code>${step.action || '—'}</code></div>`;
    } else {
        html += `<div class="trace-row"><strong>Mensaje:</strong> <code>${step.message || '—'}</code></div>`;
        if (step.depth !== undefined) {
            html += `<div class="trace-row"><strong>Profundidad:</strong> <code>${step.depth}</code></div>`;
        }
    }
    $('#current-step-card').innerHTML = html;
    setText('#step-counter', `${state.currentStep + 1} / ${r.trace.length}`);

    // Resaltar item current
    $$('#trace-list .trace-item').forEach((el, i) => {
        el.classList.toggle('current', i === state.currentStep);
        if (i === state.currentStep && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

let autoPlayInterval = null;
function autoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
        $('#step-play').textContent = '▶ Auto';
        return;
    }
    $('#step-play').textContent = '⏸ Pausar';
    autoPlayInterval = setInterval(() => {
        if (state.currentStep < state.result.trace.length - 1) {
            goToStep(state.currentStep + 1);
        } else {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
            $('#step-play').textContent = '▶ Auto';
        }
    }, 700);
}

// ============================================================================
// Tabs
// ============================================================================
function switchTab(tabName) {
    state.activeTab = tabName;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));
}

// Init on load
document.addEventListener('DOMContentLoaded', init);
