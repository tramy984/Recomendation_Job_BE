const pool = require("../config/db");

let tableReadyPromise = null;

const ensureEmailVerificationTable = () => {
  if (!tableReadyPromise) {
    tableReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        consumed_at TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_email_verification_active
        ON email_verification_codes(email, consumed_at, created_at);
    `);
  }

  return tableReadyPromise;
};

const createEmailVerificationCode = async ({ email, otpHash, expiresAt }) => {
  await ensureEmailVerificationTable();

  await pool.query(
    `
    UPDATE email_verification_codes
    SET consumed_at = NOW()
    WHERE email = $1
      AND consumed_at IS NULL
    `,
    [email]
  );

  const result = await pool.query(
    `
    INSERT INTO email_verification_codes
      (email, otp_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id, email, expires_at, attempts, created_at
    `,
    [email, otpHash, expiresAt]
  );

  return result.rows[0] || null;
};

const getActiveEmailVerificationCode = async (email) => {
  await ensureEmailVerificationTable();

  const result = await pool.query(
    `
    SELECT *
    FROM email_verification_codes
    WHERE email = $1
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
};

const increaseEmailVerificationAttempts = async (id) => {
  await ensureEmailVerificationTable();

  const result = await pool.query(
    `
    UPDATE email_verification_codes
    SET attempts = attempts + 1
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
};

const consumeEmailVerificationCode = async (id) => {
  await ensureEmailVerificationTable();

  const result = await pool.query(
    `
    UPDATE email_verification_codes
    SET consumed_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
};

module.exports = {
  createEmailVerificationCode,
  getActiveEmailVerificationCode,
  increaseEmailVerificationAttempts,
  consumeEmailVerificationCode,
};
