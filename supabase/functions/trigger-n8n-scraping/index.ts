import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerPayload {
  guest_id: string;
  name: string;
  position: string;
}

function parseOutputSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};

  // Keyword -> field mapping
  const keywordMap: Record<string, string> = {
    'coyuntura': 'tema_principal',
    'tema': 'tema_principal',
    'infancia': 'infancia_vida_privada',
    'carrera': 'carrera_profesional',
    'curiosidades': 'datos_curiosos',
    'curiosos': 'datos_curiosos',
  };

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

  // Fallback: numbered sections "1.", "2.", etc.
  const numRegex = /(?:^|\n)\s*(\d)\.\s*\*{0,2}([^*\n]+?)\*{0,2}\s*\n/gi;
  const numMatches: { index: number; num: string }[] = [];

  while ((match = numRegex.exec(text)) !== null) {
    numMatches.push({ index: match.index, num: match[1] });
  }

  if (numMatches.length > 0) {
    const fieldMap: Record<string, string> = {
      '1': 'tema_principal',
      '2': 'infancia_vida_privada',
      '3': 'carrera_profesional',
      '4': 'datos_curiosos',
    };

    for (let i = 0; i < numMatches.length; i++) {
      const start = text.indexOf('\n', numMatches[i].index + 1);
      const end = i + 1 < numMatches.length ? numMatches[i + 1].index : text.length;
      const content = text.slice(start, end).trim();
      const field = fieldMap[numMatches[i].num];
      if (field && content) {
        sections[field] = content;
      }
    }
    if (Object.keys(sections).length > 0) return sections;
  }

  return { tema_principal: text.trim() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      console.error('N8N_WEBHOOK_URL secret not configured');
      return new Response(
        JSON.stringify({ error: 'N8N webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: TriggerPayload = await req.json();
    
    if (!payload.guest_id || !payload.name || !payload.position) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: guest_id, name, position' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Triggering n8n scraping for guest: ${payload.name} (${payload.position})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${supabaseUrl}/functions/v1/n8n-guest-info`;

    const n8nPayload = {
      guest_id: payload.guest_id,
      name: payload.name,
      position: payload.position,
      callback_url: callbackUrl
    };

    console.log(`Sending to n8n webhook: ${n8nWebhookUrl}`);

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`n8n webhook error: ${n8nResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Failed to trigger n8n webhook', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read and parse n8n response
    let dataSaved = false;
    let savedData: Record<string, string> = {};
    try {
      const responseText = await n8nResponse.text();
      console.log(`n8n raw response: ${responseText}`);

      if (responseText) {
        let n8nData = JSON.parse(responseText);
        
        // Support array response from n8n "All Incoming Items"
        if (Array.isArray(n8nData)) {
          console.log(`n8n returned array with ${n8nData.length} items, using first`);
          n8nData = n8nData[0] || {};
        }
        
        console.log(`n8n parsed response keys: ${Object.keys(n8nData).join(', ')}`);

        // Extract data - support multiple response structures
        let extractedData: Record<string, string | undefined> = {};

        if (n8nData.output !== undefined) {
          console.log(`Found "output" field, type: ${typeof n8nData.output}`);
          
          if (typeof n8nData.output === 'object' && n8nData.output !== null) {
            extractedData = n8nData.output;
          } else if (typeof n8nData.output === 'string') {
            // Parse sections from AI Agent's text output
            console.log(`Parsing sections from output string (${n8nData.output.length} chars)`);
            extractedData = parseOutputSections(n8nData.output);
            console.log(`Parsed sections: ${Object.keys(extractedData).join(', ')}`);
          }
        } else {
          extractedData = n8nData;
        }

        const hasData = extractedData.tema_principal || extractedData.infancia_vida_privada ||
                        extractedData.carrera_profesional || extractedData.datos_curiosos;

        if (hasData) {
          console.log('Data found, saving to database...');

          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          const updateData: Record<string, string> = {
            n8n_updated_at: new Date().toISOString(),
          };

          if (extractedData.tema_principal !== undefined) updateData.tema_principal = extractedData.tema_principal;
          if (extractedData.infancia_vida_privada !== undefined) updateData.infancia_vida_privada = extractedData.infancia_vida_privada;
          if (extractedData.carrera_profesional !== undefined) updateData.carrera_profesional = extractedData.carrera_profesional;
          if (extractedData.datos_curiosos !== undefined) updateData.datos_curiosos = extractedData.datos_curiosos;

          const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', payload.guest_id);

          if (error) {
            console.error('Database update error:', error);
          } else {
            dataSaved = true;
            savedData = updateData;
            console.log('Guest data saved successfully');
          }
        } else {
          console.log('No relevant data fields found in n8n response');
        }
      }
    } catch (parseErr) {
      console.log('Could not parse n8n response as JSON:', parseErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: dataSaved ? 'Data saved from n8n response' : 'Scraping workflow triggered',
        data_saved: dataSaved,
        saved_data: savedData,
        guest_id: payload.guest_id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-n8n-scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
