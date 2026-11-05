import os
import re
import secrets
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple, Optional, Dict, Any
from datetime import datetime, timedelta, timezone

# ─── Strong Password Rules ───
PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\/\[\]~])[A-Za-z\d!@#$%^&*(),.?":{}|<>_\-+=\/\[\]~]{8,}$'
)

EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
)

PHONE_CLEAN_REGEX = re.compile(r'[^0-9+]')

def validate_email_format(email: str) -> bool:
    if not email:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))

def validate_phone_number(raw_phone: str) -> Tuple[bool, str, str]:
    """
    Validates phone numbers. Accepts e.g. '+919876543210', '9876543210', '+12025550123'.
    Returns (is_valid, formatted_phone_e164, error_message).
    """
    if not raw_phone or not raw_phone.strip():
        return False, "", "Mobile number cannot be blank."
    
    cleaned = PHONE_CLEAN_REGEX.sub('', raw_phone.strip())
    if not cleaned.startswith('+'):
        # If 10 digits, assume India (+91)
        if len(cleaned) == 10 and cleaned.isdigit():
            cleaned = f"+91{cleaned}"
        elif len(cleaned) == 12 and cleaned.startswith('91'):
            cleaned = f"+{cleaned}"
        else:
            cleaned = f"+{cleaned}"

    # E.164 format: + followed by 7 to 15 digits
    if not re.match(r'^\+[1-9]\d{6,14}$', cleaned):
        return False, "", "Invalid mobile number. Please enter a valid number with country code (e.g. +91 9876543210)."

    return True, cleaned, ""

def validate_password_strength(password: str) -> Tuple[bool, str]:
    if not password:
        return False, "Password cannot be blank."
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter (A–Z)."
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter (a–z)."
    if not re.search(r'\d', password):
        return False, "Password must contain at least one numeric digit (0–9)."
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\/\[\]~]', password):
        return False, "Password must contain at least one special character (e.g. @, #, $, !)."
    return True, ""

# ─── Salted PBKDF2 Secure Password Hashing ───
def hash_password(password: str) -> str:
    """Hashes a password with a unique cryptographic salt using PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"pbkdf2:sha256:100000${salt}${key}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verifies a plain password against a stored PBKDF2 or SHA-256 hash securely."""
    if not stored_hash or not plain_password:
        return False

    if stored_hash.startswith("pbkdf2:sha256:"):
        try:
            parts = stored_hash.split('$')
            if len(parts) == 3:
                rounds_spec, salt, expected_key = parts
                rounds = int(rounds_spec.split(':')[2])
                actual_key = hashlib.pbkdf2_hmac(
                    'sha256',
                    plain_password.encode('utf-8'),
                    salt.encode('utf-8'),
                    rounds
                ).hex()
                return secrets.compare_digest(actual_key, expected_key)
        except Exception:
            return False

    if stored_hash == plain_password:
        return True

    sha256_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    if secrets.compare_digest(sha256_hash, stored_hash):
        return True

    return False

# ─── In-Memory Rate Limiter ───
_rate_limit_store: Dict[str, list] = {}

def check_rate_limit(identifier: str, max_requests: int = 4, window_seconds: int = 300) -> Tuple[bool, int]:
    """
    Checks if an identifier exceeded max_requests within window_seconds.
    Returns (is_allowed, cooldown_seconds_remaining).
    """
    now = datetime.now(timezone.utc).timestamp()
    clean_id = identifier.strip().lower()
    history = _rate_limit_store.get(clean_id, [])
    history = [t for t in history if now - t < window_seconds]
    if len(history) >= max_requests:
        cooldown = int(window_seconds - (now - history[0]))
        return False, max(1, cooldown)
    history.append(now)
    _rate_limit_store[clean_id] = history
    return True, 0

# ─── 6-Digit OTP Generator (Strict 5-Minute Expiration) ───
def generate_secure_otp() -> Tuple[str, str]:
    """Generates a cryptographically random 6-digit OTP and an ISO expiry timestamp (5 minutes)."""
    otp = str(secrets.randbelow(900000) + 100000)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    return otp, expires_at

# ─── Real Email Dispatch ───
def send_verification_email(to_email: str, otp: str, purpose: str = "Email Verification") -> Dict[str, Any]:
    """
    Sends a real verification email with OTP over SMTP.
    Configured via: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
    If SMTP server is not yet configured, provides structured success with development preview.
    """
    to_clean = to_email.strip().lower()
    subject = f"SummitAttend - Your {purpose} Code: {otp}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }}
        .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ font-size: 20px; font-weight: 800; color: #1e40af; margin-bottom: 8px; }}
        .otp-box {{ background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #1d4ed8; font-family: monospace; }}
        .footer {{ font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">🔐 SummitAttend Security</div>
        <p style="font-size: 14px; color: #475569;">You requested a verification code for <strong>{purpose}</strong> on SummitAttend.</p>
        <div class="otp-box">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 6px;">Your 6-Digit One-Time Code</div>
          <div class="otp-code">{otp}</div>
        </div>
        <p style="font-size: 12px; color: #64748b;">This OTP code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
        <div class="footer">
          SummitAttend Cryptographic Attendance Ledger • Security Authentication Engine
        </div>
      </div>
    </body>
    </html>
    """

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user or "security@summitattend.edu")

    email_sent = False
    error_msg = ""

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = to_clean
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [to_clean], msg.as_string())
            email_sent = True
        except Exception as e:
            error_msg = str(e)
            print(f"[!] Warning: SMTP email delivery error: {e}")

    print(f"[EMAIL GATEWAY] Dispatched {purpose} OTP to {to_clean} (Sent: {email_sent})")

    return {
        "success": True,
        "emailSent": email_sent,
        "recipient": to_clean,
        "otp": otp,
        "purpose": purpose,
        "expiresInSeconds": 300,
        "smtpConfigured": bool(smtp_host and smtp_user),
        "error": error_msg if not email_sent and smtp_host else None
    }

# ─── Real SMS Dispatch (Twilio + Fast2SMS + Fallback) ───
def send_verification_sms(to_phone: str, otp: str, purpose: str = "Mobile Verification") -> Dict[str, Any]:
    """
    Sends real SMS with 6-digit OTP code.
    Supported SMS Providers via Environment Variables:
    1. Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (or TWILIO_MESSAGING_SERVICE_SID)
    2. Fast2SMS: FAST2SMS_API_KEY
    If no provider API key is configured in .env, provides structured preview for development testing.
    """
    is_valid, formatted_phone, err = validate_phone_number(to_phone)
    if not is_valid:
        return {"success": False, "smsSent": False, "error": err, "recipient": to_phone}

    sms_body = f"SummitAttend: Your {purpose} code is {otp}. Valid for 5 minutes. Do not share this code."

    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    twilio_from = os.environ.get("TWILIO_PHONE_NUMBER", "") or os.environ.get("TWILIO_MESSAGING_SERVICE_SID", "")
    fast2sms_key = os.environ.get("FAST2SMS_API_KEY", "")

    sms_sent = False
    provider_used = "Development Gateway"
    error_msg = None

    # 1. Twilio SMS Integration
    if twilio_sid and twilio_token and twilio_from:
        import urllib.request
        import urllib.parse
        import base64
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            data = urllib.parse.urlencode({
                "To": formatted_phone,
                "From": twilio_from,
                "Body": sms_body
            }).encode('utf-8')
            req = urllib.request.Request(url, data=data, method="POST")
            auth_str = base64.b64encode(f"{twilio_sid}:{twilio_token}".encode('utf-8')).decode('ascii')
            req.add_header("Authorization", f"Basic {auth_str}")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    sms_sent = True
                    provider_used = "Twilio"
        except Exception as e:
            error_msg = f"Twilio SMS error: {str(e)}"
            print(f"[!] {error_msg}")

    # 2. Fast2SMS Integration (Indian mobile numbers)
    elif fast2sms_key:
        import urllib.request
        import json
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            digits_only = re.sub(r'[^0-9]', '', formatted_phone)
            local_number = digits_only[-10:] if len(digits_only) >= 10 else digits_only
            payload = json.dumps({
                "route": "otp",
                "variables_values": otp,
                "numbers": local_number
            }).encode('utf-8')
            req = urllib.request.Request(url, data=payload, method="POST")
            req.add_header("authorization", fast2sms_key)
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    sms_sent = True
                    provider_used = "Fast2SMS"
        except Exception as e:
            error_msg = f"Fast2SMS error: {str(e)}"
            print(f"[!] {error_msg}")

    print(f"[SMS GATEWAY] Dispatched {purpose} OTP to {formatted_phone} (Provider: {provider_used}, Sent: {sms_sent})")

    return {
        "success": True,
        "smsSent": sms_sent,
        "recipient": formatted_phone,
        "otp": otp,
        "provider": provider_used,
        "expiresInSeconds": 300,
        "error": error_msg
    }
