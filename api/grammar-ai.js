module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'Falta GITHUB_TOKEN en las variables de entorno.' });
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

  try {
    const githubResponse = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Eres un profesor experto en compiladores. Responde siempre en español y en Markdown válido. No uses HTML. No uses JSON. Usa encabezados, listas y bloques de código Markdown.',
          },
          {
            role: 'user',
            content: buildPrompt({ grammar, input, parser, success, error, conflicts, first, follow }),
          },
        ],
      }),
    });

    const rateLimit = readRateLimitHeaders(githubResponse.headers);
    console.log('GitHub Models rate limit:', rateLimit);

    const data = await githubResponse.json().catch(() => ({}));

    if (!githubResponse.ok) {
      return res.status(githubResponse.status).json({
        error: 'Error consultando GitHub Models',
        detail: data.error?.message || data.message || githubResponse.statusText,
        rateLimit,
      });
    }

    return res.status(200).json({
      answer: data.choices?.[0]?.message?.content?.trim() || 'No se obtuvo respuesta.',
      rateLimit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Error interno consultando GitHub Models',
      detail: err.message,
      rateLimit: null,
    });
  }
};

function readRateLimitHeaders(headers) {
  return {
    limitRequests: headers.get('x-ratelimit-limit-requests') || headers.get('x-ratelimit-limit'),
    remainingRequests: headers.get('x-ratelimit-remaining-requests') || headers.get('x-ratelimit-remaining'),
    resetRequests: headers.get('x-ratelimit-reset-requests') || headers.get('x-ratelimit-reset'),
    limitTokens: headers.get('x-ratelimit-limit-tokens'),
    remainingTokens: headers.get('x-ratelimit-remaining-tokens'),
    resetTokens: headers.get('x-ratelimit-reset-tokens'),
    retryAfter: headers.get('retry-after'),
  };
}

function buildPrompt(context) {
  return `Eres un asistente experto en compiladores, gramáticas formales y análisis sintáctico LL/LR.

Tu tarea es analizar la gramática proporcionada y responder SOLO lo necesario.

Reglas importantes:
- Responde SIEMPRE en Markdown válido.
- Sé breve, concreto y accionable.
- No escribas secciones vacías.
- No des ejemplos si no propones una gramática nueva.
- No propongas cambios si la gramática ya está bien para el parser seleccionado.
- No expliques conceptos generales si no son necesarios para este caso.
- No repitas todo el contexto recibido.
- No inventes el objetivo de la gramática si no está claro.
- Si no hay conflictos ni errores relevantes, dilo brevemente y termina.
- Si hay conflictos, explica solo los conflictos importantes.
- Si eliminar recursión izquierda no basta, dilo explícitamente y explica por qué en pocas líneas.
- Si es posible corregir la gramática, propón una versión corregida.
- Si no es posible corregirla con seguridad sin conocer el lenguaje objetivo, dilo claramente.

Criterios de análisis:
- Revisa conflictos LL/LR.
- Revisa recursión izquierda directa o indirecta.
- Revisa ambigüedad.
- Revisa uso problemático de ε.
- Revisa conflictos FIRST/FOLLOW.
- Revisa conflictos shift/reduce o reduce/reduce.
- Revisa concatenación problemática.
- Revisa precedencia y asociatividad si hay operadores.

Formato de respuesta:
- Usa Markdown.
- Usa como máximo 3 secciones.
- Usa títulos con ## solo si son necesarios.
- Usa bloques de código solo para mostrar una gramática corregida.
- No uses HTML.
- No uses JSON.

Estructura recomendada, pero NO obligatoria:
- ## Diagnóstico
- ## Propuesta de mejora
- ## Recomendación

Si la gramática está bien:
Responde algo breve como:
## Diagnóstico
No se detectan conflictos relevantes para el parser seleccionado. La gramática parece adecuada para este caso.

Si hay conflictos:
Explica el conflicto y la causa probable.

Si hay propuesta:
Incluye la gramática corregida en un bloque de código.

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

Resultado actual:
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

Responde de forma breve. Incluye solo lo necesario para este caso.`;
}