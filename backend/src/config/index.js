require('dotenv').config();

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const str = (v, d) => (v === undefined || v === '' ? d : String(v));

const config = {
  env: str(process.env.NODE_ENV, 'development'),
  port: num(process.env.PORT, 4000),
  appUrl: str(process.env.APP_URL, 'http://localhost:4000'),

  db: {
    host: str(process.env.DB_HOST, '127.0.0.1'),
    port: num(process.env.DB_PORT, 3306),
    user: str(process.env.DB_USER, 'root'),
    password: str(process.env.DB_PASSWORD, ''),
    name: str(process.env.DB_NAME, 'neardear'),
    poolMin: num(process.env.DB_POOL_MIN, 2),
    poolMax: num(process.env.DB_POOL_MAX, 10),
    // Managed MySQL (Aiven, PlanetScale, …) refuses plaintext connections.
    // DB_SSL_CA holds the provider's CA certificate; without it the handshake
    // fails, since these providers sign with their own CA rather than one Node
    // already trusts.
    ssl: str(process.env.DB_SSL, 'false') === 'true',
    sslCa: str(process.env.DB_SSL_CA, ''),
  },

  jwt: {
    accessSecret: str(process.env.JWT_ACCESS_SECRET, 'dev_access_secret'),
    refreshSecret: str(process.env.JWT_REFRESH_SECRET, 'dev_refresh_secret'),
    accessExpires: str(process.env.JWT_ACCESS_EXPIRES, '7d'),
    refreshExpires: str(process.env.JWT_REFRESH_EXPIRES, '30d'),
  },

  otp: {
    provider: str(process.env.OTP_PROVIDER, 'mock'), // 'mock' | 'msg91'
    devCode: str(process.env.OTP_DEV_CODE, '123456'),
    expiryMinutes: num(process.env.OTP_EXPIRY_MINUTES, 10),
    msg91: {
      authKey: str(process.env.MSG91_AUTH_KEY, ''),
      templateId: str(process.env.MSG91_OTP_TEMPLATE_ID, ''),
      senderId: str(process.env.MSG91_SENDER_ID, 'NEARDR'),
    },
  },

  // SMTP for email OTP. When OTP_PROVIDER is 'mock' (dev) the static devCode is
  // used and no email is actually sent; set these to send real email OTPs.
  smtp: {
    host: str(process.env.SMTP_HOST, ''),
    port: num(process.env.SMTP_PORT, 587),
    secure: str(process.env.SMTP_SECURE, 'false') === 'true',
    user: str(process.env.SMTP_USER, ''),
    pass: str(process.env.SMTP_PASS, ''),
    from: str(process.env.SMTP_FROM, 'NearDear <no-reply@neardear.app>'),
  },

  aadhaar: {
    provider: str(process.env.AADHAAR_PROVIDER, 'mock'), // 'mock' | 'surepass'
    devOtp: str(process.env.AADHAAR_DEV_OTP, '123456'),
    surepass: {
      baseUrl: str(process.env.SUREPASS_BASE_URL, 'https://kyc-api.surepass.io'),
      token: str(process.env.SUREPASS_TOKEN, ''),
    },
  },

  uploads: {
    dir: str(process.env.UPLOAD_DIR, 'uploads'),
    maxMb: num(process.env.MAX_UPLOAD_MB, 10),
  },

  // Push notifications (FCM). The service-account JSON is base64'd into a single
  // env var because its private_key is multi-line and .env cannot hold newlines.
  //
  // Blank is a supported state, not a misconfiguration: push is simply skipped
  // and notifications remain in-app only. A contributor without Firebase access
  // can still run the whole app.
  firebase: {
    serviceAccountBase64: str(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, ''),
  },
};

module.exports = config;
