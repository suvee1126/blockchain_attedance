const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/smart-add-f776e/databases/(default)/documents';

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = Number(v.integerValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.arrayValue && v.arrayValue.values) {
      res[k] = v.arrayValue.values.map(item => item.stringValue || item.integerValue || item);
    }
  }
  return res;
}

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

    const docKey = `${identifier.replace(/[^a-zA-Z0-9_+@-]/g, '_')}_${purpose}`;
    const firestoreUrl = `${FIRESTORE_BASE}/otp_verifications/${encodeURIComponent(docKey)}`;

    const fsRes = await fetch(firestoreUrl);
    if (!fsRes.ok) {
      return res.status(400).json({ detail: 'No active verification code found for this account. Please request a new code.' });
    }

    const fsDoc = await fsRes.json();
    const data = parseFirestoreDoc(fsDoc);

    if (!data || !data.otp) {
      return res.status(400).json({ detail: 'Verification record not found. Please request a new code.' });
    }

    if (new Date(data.expiresAt) < new Date()) {
      return res.status(400).json({ detail: 'Verification code has expired (5-minute limit). Please request a new code.' });
    }

    if (data.otp !== otp) {
      return res.status(400).json({ detail: 'Incorrect verification code. Please check and try again.' });
    }

    // Mark verified in Firestore
    await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ...fsDoc.fields,
          verified: { booleanValue: true }
        }
      })
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
