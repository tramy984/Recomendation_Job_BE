const pool = require("../config/db");
const {
  createCandidateProfile,
} = require("./candidate_profile.model");
const {
  createRecruiterProfile,
} = require("./recruiter.model");

const findUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0];
};

const checkLogin = async (email) => {
  if (!email) {
    return null;
  }

  const result = await pool.query(
    `SELECT id, email, password, role, status, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
};

const getUserByIdWithPassword = async (userId) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    SELECT id, email, password, role, status, created_at
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const updateUserPasswordById = async (userId, passwordHash) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    UPDATE users
    SET password = $1
    WHERE id = $2
    RETURNING id, email, role, status, created_at
    `,
    [passwordHash, userId]
  );

  return result.rows[0] || null;
};

const getAllUsersWithFullName = async () => {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.status,
      u.created_at,
      COALESCE(cp.full_name, r.full_name) AS full_name,
      CASE
        WHEN cp.id IS NOT NULL THEN cp.id
        WHEN r.id IS NOT NULL THEN r.id
        ELSE NULL
      END AS profile_id
    FROM users u
    LEFT JOIN candidate_profile cp ON cp.user_id = u.id
    LEFT JOIN recruiter r ON r.user_id = u.id
    ORDER BY u.created_at DESC, u.id DESC
    `
  );

  return result.rows;
};

const getUserByIdWithFullName = async (userId) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.status,
      u.created_at,
      COALESCE(cp.full_name, r.full_name) AS full_name,
      CASE
        WHEN cp.id IS NOT NULL THEN cp.id
        WHEN r.id IS NOT NULL THEN r.id
        ELSE NULL
      END AS profile_id
    FROM users u
    LEFT JOIN candidate_profile cp ON cp.user_id = u.id
    LEFT JOIN recruiter r ON r.user_id = u.id
    WHERE u.id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const updateUserStatusById = async (userId, status) => {
  if (!userId) return null;

  const result = await pool.query(
    `
    UPDATE users
    SET status = $2
    WHERE id = $1
    RETURNING id
    `,
    [userId, status]
  );

  if (!result.rows[0]) return null;

  return getUserByIdWithFullName(result.rows[0].id);
};

const createUser = async ({ fullName, email, passwordHash, role }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, status, created_at`,
      [email, passwordHash, role]
    );

    const user = userResult.rows[0];
    let profile = null;

    if (role === "candidate") {
      profile = await createCandidateProfile(client, {
        userId: user.id,
        fullName,
      });
    }

    if (role === "recruiter") {
      profile = await createRecruiterProfile(client, {
        userId: user.id,
        fullName,
      });
    }

    await client.query("COMMIT");

    return {
      ...user,
      profile,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findUserByEmail,
  checkLogin,
  createUser,
  getAllUsersWithFullName,
  getUserByIdWithFullName,
  getUserByIdWithPassword,
  updateUserStatusById,
  updateUserPasswordById,
};
