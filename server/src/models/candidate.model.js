const pool = require("../config/db");

const findCandidateByUserId = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      full_name,
      phone,
      location,
      gender,

      TO_CHAR(
        date_of_birth,
        'YYYY-MM-DD'
      ) AS date_of_birth,

      avatar

    FROM candidate_profile
    WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0];
};

const findCandidateById = async (candidateId) => {
  const result = await pool.query(
    `
    SELECT
      cp.id,
      cp.user_id,
      cp.full_name,
      u.email,
      cp.phone,
      cp.location,
      cp.gender,

      TO_CHAR(
        cp.date_of_birth,
        'YYYY-MM-DD'
      ) AS date_of_birth,

      cp.avatar

    FROM candidate_profile cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.id = $1
    `,
    [candidateId],
  );

  return result.rows[0];
};

const updateCandidateByUserId = async ({
  userId,
  fullName,
  phone,
  location,
  gender,
  dateOfBirth,
  avatar,
  updateAvatar,
}) => {
  const result = await pool.query(
    `
    UPDATE candidate_profile
    SET
      full_name = $1,
      phone = $2,
      location = $3,
      gender = $4,

      date_of_birth = $5::date,

      avatar = CASE
        WHEN $7::boolean = true THEN $6
        ELSE avatar
      END

    WHERE user_id = $8

    RETURNING
      id,
      user_id,
      full_name,
      phone,
      location,
      gender,

      TO_CHAR(
        date_of_birth,
        'YYYY-MM-DD'
      ) AS date_of_birth,

      avatar
    `,
    [
      fullName,
      phone || null,
      location || null,

      gender === "true" ? true : gender === "false" ? false : null,

      dateOfBirth || null,

      avatar || null,

      Boolean(updateAvatar),

      userId,
    ],
  );

  return result.rows[0];
};

module.exports = {
  findCandidateById,
  findCandidateByUserId,
  updateCandidateByUserId,
};
