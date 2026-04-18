

The user wants the AI chat search to behave consistently whether the query is short ("actor", "cantante", "Carlos") or a longer natural-language question containing the same terms.

Let me look at the current edge function logic.

Current behavior (`supabase/functions/chat-guests/index.ts`):
- Splits the question into words ≥3 chars, lowercased.
- For each of the **first 5 words**, runs an `or` filter against `name/topic/position/press_contact` with gender variants.
- Always appends 30 most recent guests as "context".
- Sends merged list (capped at 50) to the LLM.

Problems causing inconsistency:
1. **Short query** ("actor") → 1 keyword → focused DB results → LLM answers precisely.
2. **Long query** ("¿qué actores tenemos programados para mayo?") → many keywords ("qué", "actores", "tenemos", "programados", "mayo") → noise words match irrelevant rows; gender variants on "qué"/"tenemos" produce garbage; the 30 recent guests dilute context further; the LLM sees 50 mixed rows and answers vaguely.
3. No stopword filtering (Spanish: "qué", "para", "tenemos", "cuál", "cuáles", "hay", "están", "todos", "este", "mes", days/months names that aren't filters but pollute search).
4. The "first 5 words" cutoff is arbitrary order-based, so meaningful nouns at position 6+ get dropped.
5. Recent-guests context (30 rows) overrides specific matches when query is generic.
6. The LLM has no signal about which rows matched the query vs. which are just "recent".

## Plan

Refactor `supabase/functions/chat-guests/index.ts` to extract intent + meaningful keywords more robustly so long questions match the same rows as short ones.

### Changes

**1. Stopword filter (Spanish)**
Add a stopword set: articles, pronouns, question words, prepositions, common verbs, time words without filter value (`qué, cuál, cuáles, quién, quiénes, hay, tenemos, están, todos, todas, este, esta, esto, ese, esa, para, por, con, sin, son, fue, fueron, ser, está, sobre, entre, también, además, programado, programada, programados, programadas, invitado, invitada, invitados, invitadas, semana, mes, día, días, hoy, mañana, ayer, próximo, próxima, pasado, pasada, viene, viene`). Filter words list against it before searching.

**2. Keep all meaningful keywords (no 5-word cap)**
After stopword removal, search using **all** remaining keywords (cap at 8 to bound query cost). This ensures "actor" ranks the same whether alone or buried in a long sentence.

**3. Date/month detection (optional but cheap)**
Detect month names (`enero…diciembre`) and day names (`lunes…jueves`) as **filters**, not as text search:
- If month detected → constrain `week_date` to that month of current/next year.
- If day name detected → constrain `day_of_week` to that day.
This makes "qué actores tenemos en mayo" filter by `month(week_date)=5 AND (name|position|topic ilike '%actor%')` instead of also searching text for "mayo".

**4. Drop the "recent guests" padding when there are matches**
Only append recent guests as fallback when the keyword search returns 0 rows. Otherwise the LLM only sees query-relevant rows. Cap at 60 to keep context tight.

**5. Tag rows with match reason for the LLM**
Prefix each row in the prompt with a tag: `[match: position=actor]` or `[recent]`. Helps the LLM distinguish strong matches from filler and avoid hallucinating relevance.

**6. Tighten system prompt**
Add: "Si la pregunta menciona una categoría/profesión (actor, cantante, chef, escritor…), responde SOLO con invitados cuya posición/cargo o tema coincida; ignora los marcados como [recent] salvo que la pregunta sea genérica. Si la pregunta menciona un mes o día, filtra por esa fecha. Sé consistente: el mismo invitado debe aparecer si se busca por nombre suelto o dentro de una pregunta larga."

**7. Lower temperature implicitly via prompt** (no model change needed; keep `google/gemini-3-flash-preview`).

### Files

| Archivo | Cambio |
|---|---|
| `supabase/functions/chat-guests/index.ts` | Stopwords ES, sin cap de 5 palabras, detección de mes/día como filtros, tag `[match]/[recent]`, recientes solo como fallback, system prompt reforzado para consistencia |

### Lo que NO cambia

- UI del chat, modelo, esquema de BD, autenticación, RLS.
- Búsqueda global de `/search` (esa es SQL directa, ya consistente).

