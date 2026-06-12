export type Game = {
  id: string;
  sport: string;
  location: string;
  start_time: string;
  end_time: string | null;
  max_players: number;
  current_players: number;
  skill_level: string | null;
  description: string | null;
  status: string;
  created_by: string | null;
  creator_username: string | null;
  repeat_weekly: boolean;
  parent_game_id: string | null;
};

export type Sport =
  | "All"
  | "Badminton"
  | "Basketball"
  | "Football"
  | "Volleyball"
  | "Frisbee";

export const SPORTS: Sport[] = [
  "All",
  "Badminton",
  "Basketball",
  "Football",
  "Volleyball",
  "Frisbee",
];

export const NTU_LOCATIONS = [
  "NTU SRC Court 1",
  "NTU SRC Court 2",
  "NTU SRC Court 3",
  "Hall 3 Court",
  "Hall 7 Court",
  "NIE Courts",
  "NTU Field",
  "The Wave",
];

export const SKILL_LEVELS = ["Chill", "Intermediate", "Competitive"];

export type Notification = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string | null;
  related_user_id: string | null;
  related_game_id: string | null;
};

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  sports_interests: string[];
  recently_abandoned_at?: string | null;
  equipped_border_id?: string | null;
};

export type Review = {
  id: string;
  reviewer_name: string;
  comment: string;
  created_at: string;
};
