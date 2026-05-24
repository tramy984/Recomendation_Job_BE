const pool = require("../config/db");

let tableReadyPromise = null;

const ensurePhoneVerificationTable = () => {
  if (!tableReadyPromise) {
    tableReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS phone_verification_codes (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        phone VARCHAR(50) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        consumed_at TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_phone_verification_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      );

      ALTER TABLE phone_verification_codes
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE phone_verification_codes
        ALTER COLUMN attempts SET DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_phone_verification_active
        ON phone_verification_codes(user_id, phone, consumed_at, created_at);
    `);
  }

  return tableReadyPromise;
};

const createPhoneVerificationCode = async ({
  userId,
  phone,
  otpHash,
  expiresAt,
}) => {
  await ensurePhoneVerificationTable();

  await pool.query(
    `
    UPDATE phone_verification_codes
    SET consumed_at = NOW()
    WHERE user_id = $1
      AND phone = $2
      AND consumed_at IS NULL
    `,
    [userId, phone]
  );

  const result = await pool.query(
    `
    INSERT INTO phone_verification_codes
      (user_id, phone, otp_hash, expires_at, attempts, created_at)
    VALUES ($1, $2, $3, $4, 0, NOW())
    RETURNING id, user_id, phone, expires_at, attempts, created_at
    `,
    [userId, phone, otpHash, expiresAt]
  );

  return result.rows[0] || null;
};

const getActivePhoneVerificationCode = async ({ userId, phone }) => {
  await ensurePhoneVerificationTable();

  const result = await pool.query(
    `
    SELECT *
    FROM phone_verification_codes
    WHERE user_id = $1
      AND phone = $2
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId, phone]
  );

  return result.rows[0] || null;
};

const increasePhoneVerificationAttempts = async (id) => {
  await ensurePhoneVerificationTable();

  const result = await pool.query(
    `
    UPDATE phone_verification_codes
    SET attempts = attempts + 1
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
};

const consumePhoneVerificationCode = async (id) => {
  await ensurePhoneVerificationTable();

  const result = await pool.query(
    `
    UPDATE phone_verification_codes
    SET consumed_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
};

module.exports = {
  createPhoneVerificationCode,
  getActivePhoneVerificationCode,
  increasePhoneVerificationAttempts,
  consumePhoneVerificationCode,
};
