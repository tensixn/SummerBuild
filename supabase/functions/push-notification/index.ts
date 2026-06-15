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

    const body = await req.json()
    const { target_user_id, title, body: msgBody, data: msgData, game_id, joiner_name, joiner_id } = body

    // Generic push to a specific user (e.g. game invites) — token lookup stays server-side
    if (target_user_id) {
      if (!title || !msgBody) {
        return new Response(JSON.stringify({ error: 'Missing title or body' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('id', target_user_id)
        .single()

      if (!profile?.expo_push_token) {
        return new Response(JSON.stringify({ sent: false, reason: 'no_token' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: profile.expo_push_token,
          title,
          body: msgBody,
          data: msgData ?? {},
          sound: 'default',
          channelId: 'games',
        }),
      })

      const result = await res.json()
      return new Response(JSON.stringify({ sent: true, result }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Legacy: "player joined" notification sent to the game creator
    if (!game_id || !joiner_name) {
      return new Response(JSON.stringify({ error: 'Missing game_id or joiner_name' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: game } = await supabase
      .from('games')
      .select('created_by, sport')
      .eq('id', game_id)
      .single()

    if (!game) {
      return new Response(JSON.stringify({ sent: false, reason: 'game_not_found' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Don't notify when the creator joins their own game
    if (joiner_id && game.created_by === joiner_id) {
      return new Response(JSON.stringify({ sent: false, reason: 'joiner_is_creator' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', game.created_by)
      .single()

    if (!profile?.expo_push_token) {
      return new Response(JSON.stringify({ sent: false, reason: 'no_token' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: profile.expo_push_token,
        title: 'New player joined!',
        body: `${joiner_name} joined your ${game.sport} game`,
        data: { type: 'player_joined', game_id },
        sound: 'default',
        channelId: 'games',
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify({ sent: true, result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
