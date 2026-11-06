// Supabase REST endpoint for centralized OTP verification
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://qheqjumkbqczmygfymwe.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_publishable_hp-QiVaif8bW6GDtWzweyw_O3But7xN';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const identifier = (body.identifier || body.email || body.phone || '').trim();
    const otp = (body.otp || '').trim();
    const purpose = (body.purpose || 'verification').trim().toLowerCase();

    if (!identifier || !otp) {
      return res.status(400).json({ detail: 'Identifier and OTP code are required.' });
    }

    const queryUrl = `${SUPABASE_URL}/rest/v1/otp_verifications?identifier=eq.${encodeURIComponent(identifier)}&purpose=eq.${encodeURIComponent(purpose)}&select=*`;
    const sbRes = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) {
      return res.status(400).json({ detail: 'No active verification code found for this account. Please request a new code.' });
    }

    const records = await sbRes.json();
    const data = Array.isArray(records) && records.length > 0 ? records[0] : null;

    if (!data || !data.otp) {
      return res.status(400).json({ detail: 'Verification record not found. Please request a new code.' });
    }

    if (data.verified) {
      return res.status(400).json({ detail: 'This verification code has already been used. Please request a fresh code.' });
    }

    const expiresAt = data.expires_at || data.expiresAt;
    if (new Date(expiresAt) < new Date()) {
      return res.status(400).json({ detail: 'Verification code has expired (5-minute limit). Please request a new code.' });
    }

    if (data.otp !== otp) {
      // Increment attempts
      await fetch(`${SUPABASE_URL}/rest/v1/otp_verifications?identifier=eq.${encodeURIComponent(identifier)}&purpose=eq.${encodeURIComponent(purpose)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ attempts: (data.attempts || 0) + 1 })
      });
      return res.status(400).json({ detail: 'Incorrect verification code. Please check and try again.' });
    }

    // Mark verified in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/otp_verifications?identifier=eq.${encodeURIComponent(identifier)}&purpose=eq.${encodeURIComponent(purpose)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ verified: true })
    });

    return res.status(200).json({
      success: true,
      message: 'Verification successful.',
      verified: true
    });
  } catch (err) {
    console.error('[Verify OTP Error]:', err);
    return res.status(500).json({ detail: err.message || 'Internal server error' });
  }
}
