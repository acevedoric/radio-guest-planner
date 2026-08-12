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

    console.log(`Triggering n8n scraping for guest: ${payload.name} (${payload.position}), slot: ${slot}`);

    const callbackUrl = `${supabaseUrl}/functions/v1/n8n-guest-info`;

    const documents = payload.documents ?? [];
    const referenceUrls = payload.reference_urls ?? [];

    const n8nPayload: Record<string, unknown> = {
      guest_id: payload.guest_id,
      name: payload.name,
      position: payload.position,
      topic: payload.topic || '',
      hour_number: slot,
      documents,
      reference_urls: referenceUrls,
      callback_url: callbackUrl,
      slot,
    };

    // Compatibilidad con el workflow actual de n8n (un solo documento)
    const firstDoc = documents[0];
    const legacyUrl = payload.document_url ?? firstDoc?.file_url ?? null;
    const legacyName = payload.document_name ?? firstDoc?.file_name ?? null;
    if (legacyUrl) n8nPayload.document_url = legacyUrl;
    if (legacyName) n8nPayload.document_name = legacyName;


    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      console.error(`n8n webhook error: ${n8nResponse.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to trigger n8n webhook' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let dataSaved = false;
    try {
      const responseText = await n8nResponse.text();
      if (responseText) {
        let n8nData = JSON.parse(responseText);
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
        if (hasData) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const timestampKey = slot === 1 ? 'n8n_updated_at' : `h${slot}_n8n_updated_at`;
          const updateData: Record<string, string> = {
            [timestampKey]: new Date().toISOString(),
          };

          for (const field of slotConfig.fields) {
            if (extractedData[field] !== undefined) {
              updateData[field] = String(extractedData[field]).slice(0, 10000);
            }
          }

          const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', payload.guest_id);

          if (error) {
            console.error('Database update error:', error);
          } else {
            dataSaved = true;
            console.log('Guest data saved successfully for slot', slot);
          }
        }
      }
    } catch (parseErr) {
      console.log('Could not parse n8n response');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: dataSaved ? 'Data saved from n8n response' : 'Scraping workflow triggered',
        data_saved: dataSaved,
        guest_id: payload.guest_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in trigger-n8n-scraping:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
