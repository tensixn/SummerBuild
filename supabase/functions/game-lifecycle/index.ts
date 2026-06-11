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

    const now = new Date().toISOString()

    async function awardCoins(userId: string, amount: number, reason: string, gameId: string) {
      await supabase.from('coin_transactions').insert({ user_id: userId, amount, reason, game_id: gameId })
    }

    async function notifyGameStatus(gameId: string, event: 'started' | 'ended') {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/game-status-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ game_id: gameId, event }),
      })
    }

    async function awardCoinsForGame(game: { id: string; created_by: string | null }) {
      const { data: parts } = await supabase
        .from('game_participants')
        .select('user_id')
        .eq('game_id', game.id)
        .not('user_id', 'is', null)
      const partList = (parts ?? []) as { user_id: string }[]
      const othersJoined = partList.some((p) => p.user_id !== game.created_by)
      if (!othersJoined) return
      for (const p of partList) {
        if (p.user_id) await awardCoins(p.user_id, 2, 'game_complete', game.id)
      }
      if (game.created_by) await awardCoins(game.created_by, 5, 'host_complete', game.id)
    }

    // 1. open/full → in_progress: start_time has passed, end_time hasn't yet
    const { data: newlyStarted } = await supabase
      .from('games')
      .update({ status: 'in_progress' })
      .in('status', ['open', 'full'])
      .not('end_time', 'is', null)
      .lt('start_time', now)
      .gt('end_time', now)
      .select('id')
    for (const g of newlyStarted ?? []) notifyGameStatus(g.id, 'started')

    // 2. in_progress → completed: end_time has passed
    const { data: newlyClosed } = await supabase
      .from('games')
      .update({ status: 'completed' })
      .eq('status', 'in_progress')
      .not('end_time', 'is', null)
      .lt('end_time', now)
      .select('id, created_by')
    for (const game of newlyClosed ?? []) {
      notifyGameStatus(game.id, 'ended')
      await awardCoinsForGame(game)
    }

    // 3. open/full → completed: no end_time, start_time has passed (no coins — open-ended game)
    const { data: closedNoEnd } = await supabase
      .from('games')
      .update({ status: 'completed' })
      .in('status', ['open', 'full'])
      .is('end_time', null)
      .lt('start_time', now)
      .select('id')
    for (const g of closedNoEnd ?? []) notifyGameStatus(g.id, 'ended')

    // 4. open/full → completed: skipped in_progress (app was idle between start and end)
    const { data: closedSkipped } = await supabase
      .from('games')
      .update({ status: 'completed' })
      .in('status', ['open', 'full'])
      .not('end_time', 'is', null)
      .lt('end_time', now)
      .select('id, created_by')
    for (const game of closedSkipped ?? []) {
      notifyGameStatus(game.id, 'ended')
      await awardCoinsForGame(game)
    }

    const processed =
      (newlyStarted?.length ?? 0) +
      (newlyClosed?.length ?? 0) +
      (closedNoEnd?.length ?? 0) +
      (closedSkipped?.length ?? 0)

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
