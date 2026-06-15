-- Prevent any authenticated client from reading other users' push tokens.
-- Edge functions use service_role which bypasses column privileges, so
-- push-notification and game-status-notifications are unaffected.
-- UPDATE (used by setupNotifications to save a user's own token) is unaffected.
REVOKE SELECT (expo_push_token) ON public.profiles FROM authenticated;
