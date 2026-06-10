import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Constants from 'expo-constants';

const NOTIF_MAP_KEY = '@game_notif_ids';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('games', {
      name: 'Game Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId as string | undefined ??
    Constants.easConfig?.projectId as string | undefined;

  if (!projectId) {
    console.warn('[Notifications] No EAS projectId found — push token not registered. Add extra.eas.projectId to app.json.');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { data: { user } } = await supabase.auth.getUser();
    if (user && token) {
      await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
    }
  } catch (e) {
    console.warn('[Notifications] Failed to get push token:', e);
  }
}

type NotifMap = Record<string, string>; // gameId → scheduled notification ID

async function loadNotifMap(): Promise<NotifMap> {
  const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function syncGameStartNotifications(
  upcomingGames: Array<{ id: string; start_time: string; sport: string; location: string }>,
): Promise<void> {
  const map = await loadNotifMap();
  const upcomingSet = new Set(upcomingGames.map((g) => g.id));
  const nextMap: NotifMap = {};

  // Cancel reminders for games the user left or that are no longer upcoming
  for (const [gameId, notifId] of Object.entries(map)) {
    if (!upcomingSet.has(gameId)) {
      await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
    }
  }

  for (const game of upcomingGames) {
    const triggerMs = new Date(game.start_time).getTime() - 15 * 60 * 1000;
    if (triggerMs <= Date.now()) continue; // Reminder window already passed

    if (map[game.id]) {
      nextMap[game.id] = map[game.id]; // Already scheduled, keep it
      continue;
    }

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Game starting soon!',
        body: `Your ${game.sport} at ${game.location} starts in 15 min`,
        data: { type: 'game_starting', game_id: game.id },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerMs),
      },
    });

    nextMap[game.id] = notifId;
  }

  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(nextMap));
}

export function notifyGameStatus(gameId: string, event: 'started' | 'ended' | 'cancelled'): void {
  supabase.functions
    .invoke('game-status-notifications', { body: { game_id: gameId, event } })
    .catch(() => {});
}
