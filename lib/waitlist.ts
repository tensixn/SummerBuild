import { supabase } from "./supabase";

export async function promoteFromWaitlist(gameId: string): Promise<void> {
  const { data: first } = await supabase
    .from("game_waitlist")
    .select("id, user_id, user_name")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!first) return;

  const { error } = await supabase.from("game_participants").insert({
    game_id: gameId,
    user_id: first.user_id,
    user_name: first.user_name,
  });
  if (error) return; // race condition: already a participant

  await supabase.from("game_waitlist").delete().eq("id", first.id);

  const { data: game } = await supabase
    .from("games")
    .select("sport, location")
    .eq("id", gameId)
    .maybeSingle();

  await supabase.from("notifications").insert({
    user_id: first.user_id,
    message: game
      ? `A spot opened up — you're in the ${game.sport} game at ${game.location}!`
      : "A spot opened up — you've been added to the game!",
    type: "waitlist_promoted",
    related_game_id: gameId,
    is_read: false,
  });
}
