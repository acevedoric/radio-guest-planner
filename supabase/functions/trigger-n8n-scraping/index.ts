import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Handle CORS preflight
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

    // Build callback URL for n8n to send data back
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const callbackUrl = `${supabaseUrl}/functions/v1/n8n-guest-info`;

    // Send webhook to n8n
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
      headers: {
        'Content-Type': 'application/json',
      },
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

    console.log('Successfully triggered n8n scraping workflow');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Scraping workflow triggered',
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
