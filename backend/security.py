import os
import re
import secrets
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# ─── Load Environment Variables ───
# Automatically load .env from current working dir, project root, and backend/
load_dotenv()
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_project_root, ".env"))
load_dotenv(os.path.join(_project_root, ".env.local"))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

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

# ─── PBKDF2 Password Hashing & Verification ───
def hash_password(plain_password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a secure salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        plain_password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verifies a plain password against a stored PBKDF2 or SHA-256 hash securely."""
    if not stored_hash or not plain_password:
        return False

    if stored_hash.startswith("pbkdf2:sha256:"):
        try:
            parts = stored_hash.split('$')
            iterations = int(parts[0].split(':')[-1])
            salt = parts[1]
            stored_key = parts[2]
            computed_key = hashlib.pbkdf2_hmac(
                'sha256',
                plain_password.encode('utf-8'),
                salt.encode('utf-8'),
                iterations
            ).hex()
            return secrets.compare_digest(stored_key, computed_key)
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

# ─── Email Configuration Inspector ───
def get_email_config() -> Dict[str, Any]:
    """
    Retrieves and normalizes SMTP/Gmail configuration from environment variables.
    Supports GMAIL_USER, GMAIL_APP_PASSWORD, SMTP_USER, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT.
    """
    user = (
        os.environ.get("GMAIL_USER") or
        os.environ.get("SMTP_USER") or
        os.environ.get("EMAIL_USER") or
        ""
    ).strip()

    raw_password = (
        os.environ.get("GMAIL_APP_PASSWORD") or
        os.environ.get("SMTP_PASSWORD") or
        os.environ.get("SMTP_PASS") or
        os.environ.get("EMAIL_PASS") or
        ""
    ).strip()

    # Google App Passwords often have spaces (e.g. 'abcd efgh ijkl mnop')
    # Stripping spaces prevents SMTPAuthenticationError
    password = raw_password.replace(" ", "")

    host = (os.environ.get("SMTP_HOST") or "").strip()
    if not host and (user.endswith("@gmail.com") or os.environ.get("GMAIL_APP_PASSWORD")):
        host = "smtp.gmail.com"

    port_str = (os.environ.get("SMTP_PORT") or "").strip()
    port = int(port_str) if port_str.isdigit() else 587

    sender = (os.environ.get("SMTP_FROM") or "").strip()
    if not sender and user:
        sender = f"SummitAttend Security <{user}>"

    resend_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    sendgrid_key = (os.environ.get("SENDGRID_API_KEY") or "").strip()

    is_configured = bool((host and user and password) or resend_key or sendgrid_key)
    provider_name = "Gmail SMTP (smtp.gmail.com)" if "gmail" in host.lower() else ("Resend API" if resend_key else ("SendGrid" if sendgrid_key else "Custom SMTP"))

    return {
        "is_configured": is_configured,
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from": sender,
        "resend_key": resend_key,
        "sendgrid_key": sendgrid_key,
        "provider": provider_name
    }

# ─── Real Email Dispatch (Gmail SMTP TLS/SSL + Resend + Fallback) ───
def send_verification_email(to_email: str, otp: str, purpose: str = "Email Verification") -> Dict[str, Any]:
    """
    Sends a real verification email with 6-digit OTP to user's Gmail inbox.
    Uses Gmail SMTP over TLS port 587 (with automatic fallback to SSL port 465).
    """
    to_clean = to_email.strip().lower()
    subject = f"SummitAttend - Your {purpose} Code: {otp}"

    cfg = get_email_config()
    email_sent = False
    error_msg = ""
    provider_used = cfg["provider"]

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }}
        .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ font-size: 20px; font-weight: 800; color: #1e40af; margin-bottom: 8px; }}
        .otp-box {{ background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }}
        .footer {{ font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">🔐 SummitAttend Security</div>
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">You requested an authentication code for <strong>{purpose}</strong> on the Smart Attendance System.</p>
        <div class="otp-box">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 8px;">Your 6-Digit Verification Code</div>
          <div class="otp-code">{otp}</div>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">This code will expire in <strong>5 minutes</strong>. If you did not request this verification, you can safely ignore this email.</p>
        <div class="footer">
          SummitAttend Blockchain Attendance System • Cryptographic Authentication Engine
        </div>
      </div>
    </body>
    </html>
    """

    text_content = (
        f"SummitAttend Security Verification\n\n"
        f"Your 6-digit {purpose} code is: {otp}\n\n"
        f"This code will expire in 5 minutes.\n"
        f"Do not share this code with anyone."
    )

    if cfg["is_configured"]:
        # 1. SMTP Delivery (Gmail or custom SMTP)
        if cfg["host"] and cfg["user"] and cfg["password"]:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = cfg["from"]
                msg["To"] = to_clean
                msg.attach(MIMEText(text_content, "plain"))
                msg.attach(MIMEText(html_content, "html"))

                if cfg["port"] == 465:
                    with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=6) as server:
                        server.login(cfg["user"], cfg["password"])
                        server.sendmail(cfg["user"], [to_clean], msg.as_string())
                else:
                    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=6) as server:
                        server.ehlo()
                        server.starttls()
                        server.ehlo()
                        server.login(cfg["user"], cfg["password"])
                        server.sendmail(cfg["user"], [to_clean], msg.as_string())
                email_sent = True
                print(f"[EMAIL SUCCESS] Dispatched OTP code to Gmail inbox: {to_clean} via {cfg['host']}:{cfg['port']}")
            except smtplib.SMTPAuthenticationError as auth_err:
                error_msg = f"Gmail authentication error: Invalid Gmail credentials. If 2-Step Verification is enabled, generate a 16-character Google App Password in your Google Account security settings and set GMAIL_APP_PASSWORD in .env."
                print(f"[!] {error_msg}")
            except Exception as e:
                # If Port 587 failed, attempt Port 465 SSL fallback if host is Gmail
                if "gmail" in cfg["host"].lower() and cfg["port"] != 465:
                    try:
                        print(f"[*] Port 587 error ({e}), attempting fallback via Gmail SSL Port 465...")
                        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=6) as ssl_server:
                            ssl_server.login(cfg["user"], cfg["password"])
                            ssl_server.sendmail(cfg["user"], [to_clean], msg.as_string())
                        email_sent = True
                        print(f"[EMAIL SUCCESS] Dispatched OTP code to Gmail inbox: {to_clean} via smtp.gmail.com:465 (SSL)")
                    except Exception as ssl_err:
                        error_msg = f"SMTP error on port 587 ({e}) and port 465 ({ssl_err}). Outbound SMTP is blocked by current network/firewall gateway. Connect to mobile hotspot or home network where port 587 is open."
                        print(f"[!] {error_msg}")
                else:
                    error_msg = f"SMTP delivery error ({cfg['host']}:{cfg['port']}): {str(e)}"
                    print(f"[!] {error_msg}")

        # 2. Resend API Delivery
        elif cfg["resend_key"]:
            import urllib.request
            import json
            try:
                req_data = json.dumps({
                    "from": cfg["from"] or "SummitAttend <onboarding@resend.dev>",
                    "to": [to_clean],
                    "subject": subject,
                    "html": html_content
                }).encode('utf-8')
                req = urllib.request.Request("https://api.resend.com/emails", data=req_data, method="POST")
                req.add_header("Authorization", f"Bearer {cfg['resend_key']}")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 201):
                        email_sent = True
                        provider_used = "Resend API"
                        print(f"[EMAIL SUCCESS] Dispatched OTP to {to_clean} via Resend API")
            except Exception as e:
                error_msg = f"Resend API error: {str(e)}"
                print(f"[!] {error_msg}")

    else:
        print(f"[!] [EMAIL GATEWAY] Notice: Gmail SMTP credentials not found in environment. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env for real inbox delivery. Generated development OTP: {otp}")

    return {
        "success": True,
        "emailSent": email_sent,
        "recipient": to_clean,
        "otp": otp,
        "purpose": purpose,
        "expiresInSeconds": 300,
        "smtpConfigured": cfg["is_configured"],
        "provider": provider_used,
        "error": error_msg if not email_sent and cfg["is_configured"] else None
    }

# ─── Real SMS Dispatch (Twilio + Fast2SMS + Fallback) ───
def send_verification_sms(to_phone: str, otp: str, purpose: str = "Mobile Verification") -> Dict[str, Any]:
    """
    Sends real SMS with 6-digit OTP code.
    Supported SMS Providers via Environment Variables:
    1. Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
    2. Fast2SMS: FAST2SMS_API_KEY
    If no provider API key is configured in .env, provides preview for development.
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
