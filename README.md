# NTU Sports

A mobile app for NTU students to discover, create, and join pickup sports games happening on campus — in real time.

---

## What It Does

NTU Sports connects students who want to play sports but can't always find enough people. Open the app, see what games are happening near you, and join in with one tap. You can also create your own game and fill it up fast.

**Key features:**

**Games**
- Browse and join active games across NTU courts
- Create games for Badminton, Basketball, Football, Volleyball, or Frisbee
- Set skill level: Chill, Intermediate, or Competitive
- Schedule recurring weekly games
- Filter games by sport, day of week, specific calendar date, or text search
- Waitlist system when a game is full (auto-promoted when a spot opens)
- Game hosts can kick players and cancel games
- Upcoming games quick-view section for games you've joined
- Post-game rating prompts ("To Be Rated" section after a game completes)

**Map**
- Interactive campus map showing all NTU courts
- Live busyness heatmap per court based on active player count
- Sport filter pills to show only relevant courts

**Social**
- In-game chat for each session with unread message indicators
- Invite friends directly to your game
- Star-rate and write text reviews for players after a game ends
- Friends system — send, accept, decline, and remove friends
- Friend suggestions based on mutual connections
- View friend profiles including their upcoming games, streak, and ratings

**Profile**
- Profile stats: games joined, games created, reviews received, abandoned count, friends count
- "Recently Abandoned" badge shown on profiles when a player leaves within 1 hour of game start (auto-clears after 24 hours or completing a game)
- Weekly activity streak (current and longest)
- Coins — earned by playing (+2), hosting (+5), or rating games (+1)
- Avatar border shop: buy and equip Silver, Ruby, Gold, Diamond, or Champion borders with coins
- Upload a profile photo

**Leaderboard**
- Ranks all players by their weekly activity streak

**General**
- Push notifications for game start, status updates, invites, and friend requests
- Notification mailbox for all past notifications
- Deep linking — open a specific game from a link
- Dark mode support
- Settings: change password, delete account, location permission shortcut

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Backend / Auth / DB | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| File Storage | Supabase Storage (avatar photos) |
| Maps | react-native-maps |
| Location | expo-location |
| Notifications | expo-notifications |
| Image Picker | expo-image-picker |
| Storage | AsyncStorage |
| Icons | @expo/vector-icons |

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — install with `npm install -g expo-cli`
- [Expo Go](https://expo.dev/client) app on your phone (for development), **or** an iOS/Android simulator

---

## Getting Started

**1. Clone the repo**

```bash
git clone https://github.com/tensixn/SummerBuild.git
cd SummerBuild
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the development server**

```bash
npx expo start
```

Then scan the QR code with Expo Go (Android) or the Camera app (iOS).

---

## Running on a Simulator

```bash
# iOS simulator (Mac only)
npx expo run:ios

# Android emulator
npx expo run:android
```

---

## Project Structure

```
├── App.tsx                  # Root component, tab navigation, auth gate
├── screens/
│   ├── HomeScreen.tsx       # Games feed, create/join/leave, chat, invites, ratings
│   ├── MapScreen.tsx        # Campus map, court markers, busyness heatmap
│   ├── SearchScreen.tsx     # Player search, friend requests, friend suggestions
│   ├── LeaderboardScreen.tsx# Weekly streak leaderboard
│   ├── ProfileScreen.tsx    # Profile, stats, border shop, friends, streak
│   ├── LoginScreen.tsx
│   └── SignupScreen.tsx
├── components/              # Reusable UI components
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── courts.ts            # NTU court locations and metadata
│   ├── types.ts             # Shared TypeScript types
│   ├── theme.ts             # Light/dark theme colours
│   ├── borders.ts           # Avatar border definitions and pricing
│   ├── notifications.ts     # Push notification helpers
│   └── waitlist.ts          # Waitlist promotion logic
└── supabase/
    └── functions/           # Supabase Edge Functions
```

---

## Supabase Setup

The app connects to a shared Supabase project. The URL and anon key are already set in `lib/supabase.ts` — no `.env` file is needed to run the app.

If you want to fork this with your own Supabase project, replace the values in `lib/supabase.ts`:

```ts
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";
```

You will also need to create the following tables in your Supabase project:

| Table | Purpose |
|---|---|
| `profiles` | User profiles (username, avatar, sports interests, coins, border, abandoned count) |
| `games` | Game sessions |
| `game_participants` | Records of who has joined each game |
| `game_waitlist` | Waitlist entries for full games |
| `games_with_counts` | View combining games with live participant counts |
| `game_messages` | In-game chat messages |
| `notifications` | In-app notifications (invites, friend requests, game updates) |
| `reviews` | Text reviews left on player profiles |
| `ratings` | Star ratings per player |
| `rated_game_completions` | Tracks which games a user has already rated (prevents duplicate rewards) |
| `friends` | Friend relationships and request status |
| `user_borders` | Borders owned by each user |
| `coin_transactions` | Coin earn/spend history |

You will also need a Supabase Storage bucket named `avatars` for profile photo uploads.

---

## Authentication

Supports two sign-in methods:
- **Email + password** (via Supabase Auth)
- **Google OAuth** (via Supabase Auth with `expo-web-browser`)

Both methods support a **Remember me** option. If disabled, the session is cleared on app close.

Deep links use the scheme `ntusports://` (e.g. `ntusports://game/<id>` opens a specific game directly).

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "add your feature"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request against `main`

Please keep PRs focused — one feature or fix per PR makes review much easier.

---

## License

This project was built as part of a student summer project at NTU.
