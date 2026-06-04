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
