import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const client = new OpenAI({
  apiKey: process.env.GITHUB_TOKEN,
  baseURL: 'https://models.github.ai/inference',
});

app.post('/api/grammar-ai', async (req, res) => {
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'Falta GITHUB_TOKEN en server/.env' });
  }

  const {
    grammar = '',
    input = '',
    parser = '',
    success = null,
    error = null,
    conflicts = [],
    first = {},
    follow = {},
  } = req.body || {};

  const prompt = buildPrompt({
    grammar,
    input,
    parser,
    success,
    error,
    conflicts,
    first,
    follow,
  });

  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-4.1',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Eres un profesor experto en compiladores. Analizas gramáticas formales con rigor, explicas conflictos LL/LR y propones mejoras concretas sin inventar resultados.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || 'No se obtuvo respuesta.';
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando GitHub Models' });
  }
});

app.listen(port, () => {
  console.log(`ParserLab AI backend escuchando en http://localhost:${port}`);
});

function buildGrammarAIPrompt(context) {
    return `
Eres un asistente experto en compiladores, gramáticas formales y análisis sintáctico LL/LR.

Tu tarea es analizar la gramática proporcionada y dar recomendaciones útiles para mejorarla, corregirla o entender sus limitaciones.

No asumas que siempre basta con aplicar transformaciones mecánicas como eliminar recursión izquierda o factorizar. Evalúa si el problema real puede ser ambigüedad, uso de ε, conflictos FIRST/FOLLOW, conflictos shift/reduce, conflictos reduce/reduce, concatenación problemática, falta de precedencia, falta de asociatividad u otra causa gramatical.

Objetivos de tu respuesta:
- Explica qué problema tiene la gramática, si existe.
- Explica conflictos LL/LR si hay.
- Propón una gramática corregida cuando sea posible.
- Da ejemplos de cadenas válidas para la gramática propuesta.
- Si la gramática ya está bien para el objetivo, dilo y justifica.
- Si no es posible proponer una corrección segura sin conocer el lenguaje objetivo, dilo claramente.
- Mantén la respuesta en español, con secciones breves y accionables.
- No inventes una intención si la gramática es ambigua o el objetivo no está claro; plantea la suposición usada.

Criterios de análisis:
- Revisa si la gramática tiene recursión izquierda directa o indirecta.
- Revisa si tiene producciones ε que puedan causar ambigüedad o ciclos.
- Revisa si hay alternativas que empiezan igual y requieren factorización.
- Revisa si hay conflictos FIRST/FOLLOW en gramáticas LL.
- Revisa si hay conflictos shift/reduce o reduce/reduce en gramáticas LR.
- Revisa si la gramática mezcla concatenación, ε y recursión de forma peligrosa.
- Revisa si la gramática necesita reglas de precedencia/asociatividad para operadores.
- Revisa si la gramática parece ambigua y explica por qué.

Contexto recibido:

Parser seleccionado:
${context.parser}

Gramática:
\`\`\`
${context.grammar}
\`\`\`

Cadena de entrada:
\`\`\`
${context.input}
\`\`\`

Resultado del parseo:
success = ${context.success}
error = ${context.error || '(ninguno)'}

Conflictos:
\`\`\`json
${JSON.stringify(context.conflicts || [], null, 2)}
\`\`\`

FIRST:
\`\`\`json
${JSON.stringify(context.first || {}, null, 2)}
\`\`\`

FOLLOW:
\`\`\`json
${JSON.stringify(context.follow || {}, null, 2)}
\`\`\`

Formato de respuesta solicitado:

## Diagnóstico
Explica el problema principal, si existe.

## Conflictos detectados
Explica los conflictos LL/LR si aparecen en el contexto.

## Sobre eliminar recursión izquierda
Indica si ayuda, si no ayuda, o si no es suficiente. Explica por qué.

## Propuesta de mejora
Propón una gramática corregida o mejor estructurada si es posible.

## Ejemplos válidos
Da algunas cadenas válidas para la gramática propuesta o para la gramática original si ya está bien.

## Recomendación final
Resume qué debería hacer el estudiante.
`;
}