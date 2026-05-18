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
              'Eres un profesor experto en compiladores. Explicas gramáticas formales con rigor, claridad y ejemplos útiles para estudiantes.',
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
  return `Analiza esta gramática en español y sugiere mejoras reales.

Debes:
- Explicar qué problema tiene la gramática, si existe.
- Explicar conflictos LL/LR si hay.
- Decir si eliminar recursión izquierda no basta y por qué.
- Proponer una gramática corregida cuando sea posible.
- Dar ejemplos de cadenas válidas.
- Explicar de forma clara para estudiantes de compiladores.

Caso importante:
Para gramáticas como:
S -> ( S ) | S S | ε
explica que la gramática es ambigua, que eliminar recursión izquierda no basta por la presencia de ε y la concatenación S S, y sugiere una forma no ambigua como:
S -> ( S ) S | ε

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

Responde con secciones breves, concretas y accionables.`;
}
