import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

// Paste your values from Supabase → Project Settings → Data API
const supabaseUrl = "https://zfefmkkcijiidfgwjmsm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZta2tjaWppaWRmZ3dqbXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjUxMTMsImV4cCI6MjA5NjA0MTExM30.8MP_0wrev1fbwdr1zrj_2GzC6G0wTD5gTCHpqohNOlU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);