const pool = require("../config/db");

const createRecruiterProfile = async (client, { userId, fullName }) => {
  const result = await client.query(
    `INSERT INTO recruiter (user_id, full_name)
     VALUES ($1, $2)
     RETURNING id, user_id, full_name`,
    [userId, fullName]
  );

  return result.rows[0];
};

const getRecruiterByUserId = async (userId) => {
  if (!userId) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT *
    FROM recruiter
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

module.exports = {
  createRecruiterProfile,
  getRecruiterByUserId,
};
