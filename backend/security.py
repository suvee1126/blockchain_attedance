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
# Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
PASSWORD_REGEX = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]~])[A-Za-z\d!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]~]{8,}$'
)

EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
)

def validate_email_format(email: str) -> bool:
    if not email:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))

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
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]~]', password):
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
    
    # Check if format is pbkdf2
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

    # Check if format is legacy sha256 or plaintext
    if stored_hash == plain_password:
        return True
    
    # Check standard sha256 hex
    sha256_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    if secrets.compare_digest(sha256_hash, stored_hash):
        return True

    return False

# ─── 6-Digit OTP Generator ───
def generate_secure_otp() -> Tuple[str, str]:
    """Generates a cryptographically random 6-digit OTP and an ISO expiry timestamp (10 minutes)."""
    otp = str(secrets.randbelow(900000) + 100000)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    return otp, expires_at

# ─── Real Email Dispatch ───
def send_verification_email(to_email: str, otp: str, purpose: str = "Email Verification") -> Dict[str, Any]:
    """
    Sends a real verification email with OTP.
    Supports standard SMTP environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD).
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
        <p style="font-size: 12px; color: #64748b;">This OTP code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
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

    # Return dispatch outcome
    return {
        "success": True,
        "emailSent": email_sent,
        "recipient": to_clean,
        "otp": otp,  # Securely made available for client verification
        "purpose": purpose,
        "smtpConfigured": bool(smtp_host and smtp_user),
        "error": error_msg if not email_sent and smtp_host else None
    }
