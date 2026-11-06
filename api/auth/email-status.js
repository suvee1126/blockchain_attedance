export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = process.env.GMAIL_USER || process.env.EMAIL_USER || 'suhas.261005@gmail.com';
  return res.status(200).json({
    smtpConfigured: true,
    provider: 'Gmail SMTP (smtp.gmail.com)',
    host: 'smtp.gmail.com',
    port: 587,
    sender: user ? `${user.slice(0, 3)}***@gmail.com` : 'configured',
    requiredVariables: []
  });
}

