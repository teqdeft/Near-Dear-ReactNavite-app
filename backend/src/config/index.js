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
};

module.exports = config;
