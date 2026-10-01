import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DocumentSchema = z.object({
  file_name: z.string().max(500),
  file_url: z.string().url().max(3000),
  file_type: z.string().max(300).nullable().optional(),
});

const TriggerPayloadSchema = z.object({
  guest_id: z.string().uuid("guest_id must be a valid UUID"),
  name: z.string().min(1).max(300),
  position: z.string().min(1).max(300),
  topic: z.string().max(2000).optional(),
  document_url: z.string().url().max(3000).nullable().optional(),
  document_name: z.string().max(500).nullable().optional(),
  documents: z.array(DocumentSchema).max(50).optional().default([]),
  reference_urls: z.array(z.string().url().max(2000)).max(50).optional().default([]),
  hour_number: z.number().int().min(1).max(3).optional(),
  slot: z.number().int().min(1).max(3).optional().default(1),
});


// Field mapping per slot for n8n response parsing
const SLOT_FIELD_MAP: Record<number, { fields: string[]; keywordMap: Record<string, string> }> = {
  1: {
    fields: ['tema_principal', 'infancia_vida_privada', 'carrera_profesional', 'datos_curiosos'],
    keywordMap: {
      'coyuntura': 'tema_principal',
      'tema': 'tema_principal',
      'infancia': 'infancia_vida_privada',
      'carrera': 'carrera_profesional',
      'curiosidades': 'datos_curiosos',
      'curiosos': 'datos_curiosos',
    },
  },
  2: {
    fields: ['h2_info_personal', 'h2_preguntas_sugeridas'],
    keywordMap: {
      'personal': 'h2_info_personal',
      'información': 'h2_info_personal',
      'info': 'h2_info_personal',
      'preguntas': 'h2_preguntas_sugeridas',
      'sugeridas': 'h2_preguntas_sugeridas',
    },
  },
  3: {
    fields: ['h3_datos_personales', 'h3_comunicado_prensa'],
    keywordMap: {
      'datos': 'h3_datos_personales',
      'personales': 'h3_datos_personales',
      'personal': 'h3_datos_personales',
      'comunicado': 'h3_comunicado_prensa',
      'prensa': 'h3_comunicado_prensa',
    },
  },
};

function parseOutputSections(text: string, slot: number): Record<string, string> {
  const sections: Record<string, string> = {};
  const slotConfig = SLOT_FIELD_MAP[slot];
  const keywordMap = slotConfig.keywordMap;

  // Try ### KEYWORD ### format first
  const hashRegex = /(?:^|\n)\s*#{1,4}\s*([^#\n]+?)\s*#{0,4}\s*\n/gi;
  const hashMatches: { index: number; keyword: string; matchEnd: number }[] = [];
  let match;

  while ((match = hashRegex.exec(text)) !== null) {
    const keyword = match[1].trim().toLowerCase();
    const field = Object.entries(keywordMap).find(([k]) => keyword.includes(k));
    if (field) {
      hashMatches.push({ index: match.index, keyword: field[1], matchEnd: match.index + match[0].length });
    }
  }

  if (hashMatches.length > 0) {
    for (let i = 0; i < hashMatches.length; i++) {
      const start = hashMatches[i].matchEnd;
      const end = i + 1 < hashMatches.length ? hashMatches[i + 1].index : text.length;
      const content = text.slice(start, end).trim();
      if (content) {
        sections[hashMatches[i].keyword] = content;
      }
    }
    if (Object.keys(sections).length > 0) return sections;
  }

  // Fallback: numbered sections
  const numRegex = /(?:^|\n)\s*(\d)\.\s*\*{0,2}([^*\n]+?)\*{0,2}\s*\n/gi;
  const numMatches: { index: number; num: string }[] = [];

  while ((match = numRegex.exec(text)) !== null) {
    numMatches.push({ index: match.index, num: match[1] });
  }

  if (numMatches.length > 0) {
    const fields = slotConfig.fields;
    for (let i = 0; i < numMatches.length; i++) {
      const start = text.indexOf('\n', numMatches[i].index + 1);
      const end = i + 1 < numMatches.length ? numMatches[i + 1].index : text.length;
      const content = text.slice(start, end).trim();
      const fieldIdx = parseInt(numMatches[i].num) - 1;
      const field = fields[fieldIdx];
      if (field && content) {
        sections[field] = content;
      }
    }
    if (Object.keys(sections).length > 0) return sections;
  }

  // Default: put everything in the first field
  return { [slotConfig.fields[0]]: text.trim() };
}

const DAY_OFFSETS: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };

/**
 * Fecha de emisión (YYYY-MM-DD, America/Bogota): week_date + día del programa.
 * Son fechas de calendario sin hora, así que se suman en UTC y el resultado no
 * depende de la zona del servidor. Sin slot asignado se usa scheduled_date.
 */
function programDate(guest: { week_date: string | null; day_of_week: string | null; scheduled_date: string | null }): string | null {
  const offset = guest.day_of_week ? DAY_OFFSETS[guest.day_of_week] : undefined;
  if (guest.week_date && offset !== undefined) {
    const d = new Date(`${guest.week_date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  return guest.scheduled_date ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      console.error('N8N_WEBHOOK_URL secret not configured');
      return new Response(
        JSON.stringify({ error: 'N8N webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawPayload = await req.json();
    const parseResult = TriggerPayloadSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = parseResult.data;
    const slot = payload.hour_number ?? payload.slot;
    const slotConfig = SLOT_FIELD_MAP[slot];
    const hour = `H${slot}`;

    console.log(`Triggering n8n scraping for guest: ${payload.name} (${payload.position}), slot: ${slot}`);

    const callbackUrl = `${supabaseUrl}/functions/v1/n8n-guest-info`;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: guestRow, error: guestError } = await adminClient
      .from('guests')
      .select('week_date, day_of_week, scheduled_date')
      .eq('id', payload.guest_id)
      .maybeSingle();

    if (guestError) console.error('Error loading guest:', guestError);
    if (!guestRow) {
      return new Response(
        JSON.stringify({ error: 'Guest not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Documentos: solo desde guest_documents de este invitado y esta hora, sin duplicados
    const { data: docRows, error: docsError } = await adminClient
      .from('guest_documents')
      .select('file_name, file_url, file_type, uploaded_at')
      .eq('guest_id', payload.guest_id)
      .eq('hour_number', slot)
      .order('uploaded_at', { ascending: true });

    if (docsError) console.error('Error loading guest documents:', docsError);

    const seen = new Set<string>();
    const documents: { file_name: string; file_url: string; file_type: string | null }[] = [];
    for (const row of docRows ?? []) {
      const path = row.file_url as string | null;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      const { data: signed, error: signError } = await adminClient.storage
        .from('guest-documents')
        .createSignedUrl(path, 60 * 60 * 24);
      if (signError || !signed?.signedUrl) {
        console.error('Could not sign document url:', path, signError);
        continue;
      }
      documents.push({
        file_name: (row.file_name as string) || 'documento',
        file_url: signed.signedUrl,
        file_type: (row.file_type as string | null) ?? null,
      });
    }

    const referenceUrls = payload.reference_urls ?? [];

    const n8nPayload: Record<string, unknown> = {
      guest_id: payload.guest_id,
      name: payload.name,
      position: payload.position,
      topic: payload.topic || '',
      program_date: programDate(guestRow),
      hour,
      hour_number: slot,
      documents,
      reference_urls: referenceUrls,
      callback_url: callbackUrl,
      slot,
    };

    // Compatibilidad con n8n: primer documento de texto (pdf, docx, doc, txt)
    const TEXT_EXT = /\.(pdf|docx?|txt)(\?|$)/i;
    const TEXT_MIME = /(pdf|msword|wordprocessingml|text\/plain)/i;
    const firstText = documents.find(
      (d) => TEXT_EXT.test(d.file_name) || TEXT_MIME.test(d.file_type ?? '')
    );
    n8nPayload.document_url = firstText?.file_url ?? null;
    n8nPayload.document_name = firstText?.file_name ?? null;

    const setResearch = async (fields: Record<string, string | null>) => {
      const { error } = await adminClient
        .from('guests')
        .update({ ...fields, research_hour: hour, research_updated_at: new Date().toISOString() })
        .eq('id', payload.guest_id);
      if (error) console.error('Could not update research status:', error);
    };

    await setResearch({ research_status: 'pending', research_error: null });

    // n8n puede tardar minutos: se llama en segundo plano y el resultado llega por el
    // callback n8n-guest-info (o en la respuesta síncrona, si el workflow la devuelve).
    const runN8n = async () => {
      try {
        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload),
        });

        if (!n8nResponse.ok) {
          console.error(`n8n webhook error: ${n8nResponse.status}`);
          await setResearch({ research_status: 'error', research_error: `n8n respondió con error ${n8nResponse.status}` });
          return;
        }

        const responseText = await n8nResponse.text();
        if (!responseText) return;

        let n8nData;
        try {
          n8nData = JSON.parse(responseText);
        } catch {
          console.log('Could not parse n8n response');
          return;
        }
        if (Array.isArray(n8nData)) n8nData = n8nData[0] || {};

        let extractedData: Record<string, string | undefined> = {};
        if (n8nData.output !== undefined) {
          if (typeof n8nData.output === 'object' && n8nData.output !== null) {
            extractedData = n8nData.output;
          } else if (typeof n8nData.output === 'string') {
            extractedData = parseOutputSections(n8nData.output, slot);
          }
        } else {
          extractedData = n8nData;
        }

        const hasData = slotConfig.fields.some(f => extractedData[f]);
        if (!hasData) return;

        const timestampKey = slot === 1 ? 'n8n_updated_at' : `h${slot}_n8n_updated_at`;
        const updateData: Record<string, string | null> = {
          [timestampKey]: new Date().toISOString(),
          research_status: 'done',
          research_error: null,
        };
        for (const field of slotConfig.fields) {
          if (extractedData[field] !== undefined) {
            updateData[field] = String(extractedData[field]).slice(0, 10000);
          }
        }
        await setResearch(updateData);
        console.log('Guest data saved from synchronous n8n response for slot', slot);
      } catch (err) {
        console.error('Error calling n8n:', err);
        await setResearch({ research_status: 'error', research_error: 'No se pudo contactar a n8n' });
      }
    };

    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(runN8n());
    } else {
      await runN8n();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scraping workflow triggered',
        research_status: 'pending',
        guest_id: payload.guest_id,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in trigger-n8n-scraping:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
