import { createClient } from '@supabase/supabase-js';

// Konfigurasi Supabase dibaca dari environment (Vite: prefix VITE_).
// Salin .env.example → .env lalu isi nilainya. Nilai fallback di bawah
// adalah URL + ANON key publik — anon key memang dirancang untuk dikirim
// ke client dan diamankan oleh Row Level Security (RLS), bukan rahasia.
// JANGAN pernah menaruh service_role key di sini (itu rahasia & bypass RLS).
const FALLBACK_URL = 'https://ykyzgaztfbvwsjdcdpwk.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXpnYXp0ZmJ2d3NqZGNkcHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjY1NDAsImV4cCI6MjA5NjE0MjU0MH0.Lv_d-Y9_2EnOtG0BhxcZlR2ItGvwJxvWGkFcA8lHh6M';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase belum dikonfigurasi: set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
