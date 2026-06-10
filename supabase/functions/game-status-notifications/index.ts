import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { game_id, event } = await req.json()
    if (!game_id || (event !== 'started' && event !== 'ended' && event !== 'cancelled')) {
      return new Response(JSON.stringify({ error: 'Missing game_id or invalid event' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: game } = await supabase
      .from('games')
      .select('sport, location')
      .eq('id', game_id)
      .single()

    if (!game) {
      return new Response(JSON.stringify({ sent: false, reason: 'game_not_found' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: participants } = await supabase
      .from('game_participants')
      .select('user_id')
      .eq('game_id', game_id)
      .not('user_id', 'is', null)

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_participants' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userIds = participants.map((p: any) => p.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .in('id', userIds)
      .not('expo_push_token', 'is', null)

    const tokens = (profiles ?? []).map((p: any) => p.expo_push_token).filter(Boolean)
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_tokens' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const title = event === 'started' ? 'Game has started!' : event === 'ended' ? 'Game has ended!' : 'Game cancelled'
    const body = event === 'started'
      ? `Your ${game.sport} at ${game.location} has started`
      : event === 'ended'
      ? `Your ${game.sport} at ${game.location} has ended`
      : `The ${game.sport} game at ${game.location} has been cancelled by the host`

    // Expo push API accepts up to 100 messages per request
    const messages = tokens.map((token: string) => ({
      to: token,
      title,
      body,
      data: { type: `game_${event}`, game_id },
      sound: 'default',
      channelId: 'games',
    }))

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })

    const result = await res.json()
    return new Response(JSON.stringify({ sent: true, count: tokens.length, result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
