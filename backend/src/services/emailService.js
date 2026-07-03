const nodemailer = require('nodemailer');
const config = require('../config');

// A single reusable transport, created lazily once SMTP is configured.
let transport = null;
function getTransport() {
  if (transport) return transport;
  const { host, port, secure, user, pass } = config.smtp;
  if (!host) return null; // SMTP not configured
  transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  return transport;
}

/**
 * Send an OTP code by email.
 * In mock/dev (no SMTP configured) this is a no-op that just logs — the static
 * dev code still works for verification, so email delivery isn't required.
 */
async function sendOtpEmail(to, code, purpose = 'login') {
  const t = getTransport();
  if (!t) {
    // Dev/mock: don't actually send; the devCode is what gets verified.
    // eslint-disable-next-line no-console
    console.log(`[emailService] (mock) OTP for ${to} [${purpose}]: ${code}`);
    return;
  }
  const subject = purpose === 'reset_password'
    ? 'Your NearDear password reset code'
    : 'Your NearDear verification code';
  await t.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: `Your NearDear code is ${code}. It expires in ${config.otp.expiryMinutes} minutes. If you didn't request this, please ignore this email.`,
    html: `<p>Your NearDear code is <b style="font-size:20px">${code}</b>.</p><p>It expires in ${config.otp.expiryMinutes} minutes. If you didn't request this, please ignore this email.</p>`,
  });
}

module.exports = { sendOtpEmail };
