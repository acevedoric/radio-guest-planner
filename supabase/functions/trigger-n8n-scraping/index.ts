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
    console.log(`Payload: ${JSON.stringify(n8nPayload)}`);

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

    // Read n8n response body to check for inline data
    let dataSaved = false;
    try {
      const responseText = await n8nResponse.text();
      console.log(`n8n response body: ${responseText}`);

      if (responseText) {
        const n8nData = JSON.parse(responseText);

        // Check if response contains any of the 4 info fields
        const hasData = n8nData.tema_principal || n8nData.infancia_vida_privada ||
                        n8nData.carrera_profesional || n8nData.datos_curiosos;

        if (hasData) {
          console.log('n8n returned inline data, saving to database...');

          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          const updateData: Record<string, string> = {
            n8n_updated_at: new Date().toISOString(),
          };

          if (n8nData.tema_principal !== undefined) updateData.tema_principal = n8nData.tema_principal;
          if (n8nData.infancia_vida_privada !== undefined) updateData.infancia_vida_privada = n8nData.infancia_vida_privada;
          if (n8nData.carrera_profesional !== undefined) updateData.carrera_profesional = n8nData.carrera_profesional;
          if (n8nData.datos_curiosos !== undefined) updateData.datos_curiosos = n8nData.datos_curiosos;

          const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', payload.guest_id);

          if (error) {
            console.error('Database update error:', error);
          } else {
            dataSaved = true;
            console.log('Guest data saved from n8n response');
          }
        }
      }
    } catch (parseErr) {
      console.log('Could not parse n8n response as JSON, waiting for callback instead');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: dataSaved ? 'Data saved from n8n response' : 'Scraping workflow triggered',
        data_saved: dataSaved,
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
