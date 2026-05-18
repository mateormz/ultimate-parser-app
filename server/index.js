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
      model: 'openai/gpt-4.1-mini',
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

function buildPrompt(context) {
  return `Analiza esta gramática en español y sugiere mejoras reales.

Objetivos de tu respuesta:
- Explica qué problema tiene la gramática, si existe.
- Explica conflictos LL/LR si hay.
- Di explícitamente si eliminar recursión izquierda no basta y por qué.
- Propón una gramática corregida cuando sea posible.
- Da ejemplos de cadenas válidas para la gramática propuesta.
- Si la gramática ya está bien para el objetivo, dilo y justifica.

Caso importante:
Para gramáticas como:
S -> ( S ) | S S | ε
debes explicar que la gramática es ambigua, que eliminar recursión izquierda no basta por ε y concatenación S S, y puedes sugerir:
S -> ( S ) S | ε

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

Responde con secciones breves y accionables.`;
}
