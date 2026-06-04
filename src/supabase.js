import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ykyzgaztfbvwsjdcdpwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXpnYXp0ZmJ2d3NqZGNkcHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjY1NDAsImV4cCI6MjA5NjE0MjU0MH0.Lv_d-Y9_2EnOtG0BhxcZlR2ItGvwJxvWGkFcA8lHh6M';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
