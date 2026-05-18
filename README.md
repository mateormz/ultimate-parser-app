# The Ultimate Parser App — CS3402 Compiladores (UTEC)

App web que implementa 6 algoritmos de parsing desde cero, con visualización paso a paso, AST, tablas dinámicas, autómata LR y análisis de gramáticas.

**Stack:** HTML + CSS + JavaScript puro. Cero dependencias de build. Cero framework. Solo Mermaid por CDN para los diagramas.

---

## Cómo probarla **ahora mismo** (sin instalar nada)

1. Descomprime la carpeta `parser-app`.
2. Abre `index.html` haciendo **doble clic** en él.
3. Listo — se abre en tu navegador y funciona.

> ⚠️ **Importante:** los diagramas (AST y autómata) usan Mermaid desde CDN, así que necesitas conexión a internet al abrirla. Todo lo demás (parsing, tablas, FIRST/FOLLOW, transformaciones) funciona 100% offline.

### Alternativa: servirla con un servidor local

Si quieres evitar cualquier problema con `file://` (algunos navegadores bloquean cosas):

```bash
cd parser-app
python3 -m http.server 8000
# Luego abre http://localhost:8000 en tu navegador
```

---

## Qué hay dentro

| Parser | Tipo | Tabla | Conflictos detecta |
|---|---|---|---|
| **Descenso Recursivo** | Top-down | — (predicción por FIRST) | Recursión izq. (la rechaza) |
| **LL(1)** | Top-down predictivo | M[A,a] | FIRST/FIRST, FIRST/FOLLOW |
| **LR(0)** | Bottom-up | ACTION/GOTO + items | shift/reduce, reduce/reduce |
| **SLR(1)** | Bottom-up | ACTION/GOTO + FOLLOW | shift/reduce, reduce/reduce |
| **LALR(1)** | Bottom-up | ACTION/GOTO + lookahead (merged) | shift/reduce, reduce/reduce |
| **LR(1)** | Bottom-up canónico | ACTION/GOTO + lookahead | shift/reduce, reduce/reduce |

### Funcionalidades

- ✅ **Parseo paso a paso** con controles ⏮ ◀ ▶ ⏭ y auto-play
- ✅ **AST** renderizado con Mermaid (con nodos hoja diferenciados)
- ✅ **Tablas dinámicas** generadas para cualquier gramática que ingreses
- ✅ **Autómata LR** visualizado con items por estado y transiciones
- ✅ **FIRST / FOLLOW** computados automáticamente
- ✅ **Detección de conflictos** con explicación clara
- ✅ **Transformación de gramáticas:**
  - Eliminar recursión izquierda (Paull)
  - Factorización izquierda
- ✅ **6 gramáticas de ejemplo** pre-cargadas (selector en la sidebar)
- ✅ **Teclado virtual** para símbolos especiales (`ε`, `→`, `|`, `'`)
- ✅ **Sugerencias de error** en lenguaje natural
- ✅ **IA integrada** (pestaña IA): analiza la gramática con GPT-4.1-mini vía GitHub Models, explica conflictos y propone una gramática corregida que puedes aplicar con un solo clic

---

## Sintaxis de la gramática

```
E -> T E'              # producción simple
E' -> + T E' | ε       # alternativas con |
T -> F T'              # comillas para marcar derivados (E', T')
F -> ( E ) | id        # paréntesis y terminales literales
```

- Flechas aceptadas: `->` o `→`
- Vacío/epsilon: `ε`, `epsilon`, o lado derecho vacío
- Terminales: cualquier token que no aparezca a la izquierda de `->`
- El símbolo inicial es la **primera** no-terminal definida

---

## Para la presentación del lunes

### Demo recomendado (orden sugerido)

1. **Cargar** "Aritmética LL(1) (factorizada)" desde el selector.
2. **Analizar Gramática** → muestra FIRST/FOLLOW completos. Buen punto para explicar.
3. **Cambiar a LL(1)**, parsear `id + id * id` → mira la **tabla M[A,a]** y la traza pila/entrada/acción.
4. **Cambiar a "Aritmética con recursión izquierda"** + LR(0) → muestra que tiene **conflictos** (state 1 con `*`). Explica por qué.
5. **Mismo input + SLR(1)** → ahora SÍ funciona. Explica FOLLOW como restricción.
6. **Mismo input + LR(1) vs LALR(1)** → muestra que LR(1) tiene **22 estados** y LALR(1) **12 estados** (merging). Conceptualmente importante.
7. **Cargar "If-then-else (dangling else)"** + SLR(1) → conflicto shift/reduce clásico.
8. **Demo transformaciones:** carga la gramática con recursión izquierda, click en "Eliminar recursión izq." y observa cómo aparecen `E'`, `T'`.

---

## Despliegue (opcional)

> ⚠️ **La función de IA requiere Vercel.** El botón "Explicar y sugerir mejora" llama a `/api/grammar-ai`, que es una serverless function de Vercel. No funciona con `open index.html` ni con `python3 -m http.server`. Para usarla debes desplegar en Vercel y configurar la variable de entorno `GITHUB_TOKEN` con un token que tenga acceso a **GitHub Models**.

### Vercel (recomendado — incluye la IA)
1. `npm i -g vercel`
2. `cd parser-app && vercel` → te da una URL pública en 30 segundos.
3. En el dashboard de Vercel, ve a **Settings → Environment Variables** y añade `GITHUB_TOKEN`.

### Netlify Drop
Solo arrastra la carpeta `parser-app` a https://app.netlify.com/drop

### GitHub Pages
```bash
cd parser-app
git init
git add . && git commit -m "Ultimate Parser App"
gh repo create --public --source=. --push
# Activa Pages en Settings → Pages → main branch
```

---

## Estructura del proyecto

```
parser-app/
├── index.html              # UI completa (single-page)
├── css/style.css           # Estilos (Technical Editorial aesthetic)
├── api/
│   └── grammar-ai.js       # Vercel serverless function — llama a GitHub Models (GPT-4.1-mini)
└── js/
    ├── grammar/
    │   ├── grammar.js      # Clase Grammar: parse BNF, FIRST/FOLLOW, augment
    │   └── transformer.js  # Eliminar recursión izq, factorización
    ├── parsers/
    │   ├── recursive-descent.js
    │   ├── ll1-parser.js
    │   ├── lr-base.js      # Clase base con items/closure/goto/parse
    │   └── lr-parsers.js   # LR(0), SLR(1), LR(1), LALR(1)
    ├── visualizers/
    │   └── visualizers.js  # AST → Mermaid, Autómata → Mermaid
    └── app.js              # Orquestación UI, estado, event handlers
```

Total: ~3500 líneas de código propio (sin librerías de parsing).
