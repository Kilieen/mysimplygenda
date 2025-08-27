// config.js
// Définissez ici votre configuration Supabase. Créez un projet sur supabase.com,
// puis renseignez l’URL du projet et la clé anonyme (anon key).
// Ces valeurs seront utilisées par auth.js et app.js pour se connecter à Supabase.

// Remplacez ces deux constantes par l’URL et la clé anonyme de votre projet Supabase.
// Rendez‑vous sur https://supabase.com/, créez un projet puis copiez :
//  - Project API → Project URL (ex: https://xyz.supabase.co)
//  - Project API → anon public key (ex: eyJh...)
const SUPABASE_URL = 'https://cbbakniijcjbcjweapsw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiYmFrbmlpamNqYmNqd2VhcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTIwMzksImV4cCI6MjA3MTg4ODAzOX0.pSkl1OiFuNJkHnTN13qywyBFiWuNMd0DyD9muyFUImw';

/*
 * Création du client Supabase.
 * La bibliothèque supabase-js doit être chargée AVANT ce fichier (voir index.html).
 * On utilise window.supabase (chargé par le script CDN) pour créer le client.
 */
let supabase;
if (typeof window !== 'undefined' && window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Exposer le client sur l’objet global pour les autres scripts
  window.supabase = supabase;
  window.supabaseClient = supabase;
} else {
  // Si la librairie n’est pas chargée, supabase restera undefined.
  console.error(
    'Supabase n’est pas disponible. Assurez‑vous que le script supabase-js est chargé avant config.js.'
  );
}