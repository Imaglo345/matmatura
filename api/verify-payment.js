import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Brak session_id' });
    }

    // 1. Zweryfikuj płatność w Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Płatność nie została zrealizowana' });
    }

    const userId = session.metadata?.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Brak userId w sesji' });
    }

    // 2. Zaktualizuj profil w Supabase (admin — pomija RLS)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseServiceKey) {
      // Fallback: użyj anon key (działa jeśli RLS pozwala)
      console.warn('Brak SUPABASE_SERVICE_KEY — używam anon key');
    }

    const apiKey = supabaseServiceKey || process.env.SUPABASE_ANON_KEY;

    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ has_course: true })
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('Supabase update error:', errText);
      return res.status(500).json({ error: 'Nie udało się nadać dostępu' });
    }

    res.status(200).json({
      success: true,
      message: 'Płatność zweryfikowana — dostęp nadany!'
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Błąd weryfikacji płatności' });
  }
}
