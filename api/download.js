export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filePath, accessToken } = req.body;

    if (!filePath || !accessToken) {
      return res.status(400).json({ error: 'Brak ścieżki pliku lub tokenu' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!serviceKey) {
      return res.status(500).json({ error: 'Brak konfiguracji serwera' });
    }

    // 1. Zweryfikuj użytkownika i sprawdź czy ma kurs
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': process.env.SUPABASE_ANON_KEY
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Nie jesteś zalogowany' });
    }

    const user = await userRes.json();

    // 2. Sprawdź czy użytkownik ma kurs
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=has_course`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    const profiles = await profileRes.json();

    if (!profiles?.[0]?.has_course) {
      return res.status(403).json({ error: 'Brak dostępu do kursu' });
    }

    // 3. Wygeneruj podpisany URL do pobrania (ważny 5 minut)
    const signRes = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/course-files/${filePath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ expiresIn: 300 })
      }
    );

    if (!signRes.ok) {
      const errText = await signRes.text();
      console.error('Storage sign error:', errText);
      return res.status(404).json({ error: 'Plik nie znaleziony' });
    }

    const signData = await signRes.json();
    const downloadUrl = `${supabaseUrl}/storage/v1${signData.signedURL}`;

    res.status(200).json({ url: downloadUrl });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Błąd pobierania pliku' });
  }
}
