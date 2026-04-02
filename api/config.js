export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const stripePk = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Brak konfiguracji serwera' });
  }

  res.status(200).json({
    supabaseUrl: url,
    supabaseAnonKey: key,
    stripePublishableKey: stripePk || null
  });
}
