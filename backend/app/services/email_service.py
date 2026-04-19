"""SMTP-based email sending service."""
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, code: str, purpose: str) -> None:
    """Send a 6-digit verification code email. Synchronous (call via run_in_executor if needed)."""
    if not SMTP_HOST or not SMTP_USER:
        logger.warning(f"SMTP not configured. Verification code for {to_email}: {code} (purpose: {purpose})")
        return

    subject_map = {
        "register": "注册验证码 - 课程智能助教",
        "reset_password": "密码重置验证码 - 课程智能助教",
    }
    subject = subject_map.get(purpose, "验证码 - 课程智能助教")

    html_body = f"""<div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;">
  <h2 style="color:#2C3E50;">{subject}</h2>
  <p>您的验证码是：</p>
  <div style="font-size:32px;font-weight:bold;color:#4A6FA5;letter-spacing:8px;padding:16px 0;text-align:center;">{code}</div>
  <p style="color:#7F8C8D;font-size:13px;">验证码有效期为5分钟。如非本人操作，请忽略此邮件。</p>
</div>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())

    logger.info(f"Verification email sent to {to_email}")
