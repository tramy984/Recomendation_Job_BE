const pool = require("../config/db");

const findCandidateIdByUserId = async (userId) => {
  const result = await pool.query(
    `
    SELECT id
    FROM candidate_profile
    WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0]?.id;
};

const countCVByCandidateId = async (candidateId) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM cvs
    WHERE candidate_id = $1
    `,
    [candidateId],
  );

  return result.rows[0].total;
};

const findCVsByCandidateId = async (candidateId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      candidate_id,
      file_url,
      created_at,
      is_default
    FROM cvs
    WHERE candidate_id = $1
    ORDER BY is_default DESC, created_at DESC
    `,
    [candidateId],
  );

  return result.rows;
};

const findCVByIdAndCandidateId = async (cvId, candidateId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      candidate_id,
      file_url,
      created_at,
      is_default
    FROM cvs
    WHERE id = $1 AND candidate_id = $2
    `,
    [cvId, candidateId],
  );

  return result.rows[0];
};

const createCV = async ({ candidateId, fileUrl, isDefault }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (isDefault) {
      await client.query(
        `
        UPDATE cvs
        SET is_default = false
        WHERE candidate_id = $1
        `,
        [candidateId],
      );
    }

    const result = await client.query(
      `
      INSERT INTO cvs (
        candidate_id,
        file_url,
        created_at,
        is_default
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
      RETURNING
        id,
        candidate_id,
        file_url,
        created_at,
        is_default
      `,
      [candidateId, fileUrl, isDefault],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const setDefaultCV = async ({ candidateId, cvId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cvResult = await client.query(
      `
      SELECT id
      FROM cvs
      WHERE id = $1 AND candidate_id = $2
      `,
      [cvId, candidateId],
    );

    if (cvResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      UPDATE cvs
      SET is_default = false
      WHERE candidate_id = $1
      `,
      [candidateId],
    );

    const result = await client.query(
      `
      UPDATE cvs
      SET is_default = true
      WHERE id = $1 AND candidate_id = $2
      RETURNING
        id,
        candidate_id,
        file_url,
        created_at,
        is_default
      `,
      [cvId, candidateId],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteCVByIdAndCandidateId = async ({ cvId, candidateId }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deleteResult = await client.query(
      `
      DELETE FROM cvs
      WHERE id = $1 AND candidate_id = $2
      RETURNING
        id,
        candidate_id,
        file_url,
        created_at,
        is_default
      `,
      [cvId, candidateId],
    );

    const deletedCV = deleteResult.rows[0];

    if (!deletedCV) {
      await client.query("ROLLBACK");
      return null;
    }

    if (deletedCV.is_default) {
      await client.query(
        `
        UPDATE cvs
        SET is_default = true
        WHERE id = (
          SELECT id
          FROM cvs
          WHERE candidate_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
        `,
        [candidateId],
      );
    }

    await client.query("COMMIT");

    return deletedCV;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findCandidateIdByUserId,
  countCVByCandidateId,
  findCVsByCandidateId,
  findCVByIdAndCandidateId,
  createCV,
  setDefaultCV,
  deleteCVByIdAndCandidateId,
};
