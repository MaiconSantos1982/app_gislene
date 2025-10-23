// Configurações do Supabase
const SUPABASE_URL = 'https://ztlddoutgextdmyiwoxl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bGRkb3V0Z2V4dGRteWl3b3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM5MTAyNTksImV4cCI6MjA0OTQ4NjI1OX0.l9qwcAL4h9Ho_IU9uNhm2wyBHaYgNbor98a17-43EpI';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
