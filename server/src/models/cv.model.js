const pool = require("../config/db");

let tableReadyPromise = null;

const ensureCVTableDefaults = () => {
  if (!tableReadyPromise) {
    tableReadyPromise = pool.query(`
      ALTER TABLE cvs
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE cvs
        ALTER COLUMN is_default SET DEFAULT FALSE;
    `);
  }

  return tableReadyPromise;
};

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

const selectCVFields = `
  id,
  candidate_id,
  file_url,
  created_at,
  is_default,
  cv_text,
  id_industry,
  degree,
  location,
  exp_min,
  exp_max
`;

const findCVsByCandidateId = async (candidateId) => {
  const result = await pool.query(
    `
    SELECT ${selectCVFields}
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
    SELECT ${selectCVFields}
    FROM cvs
    WHERE id = $1 AND candidate_id = $2
    `,
    [cvId, candidateId],
  );

  return result.rows[0];
};

const findDefaultCVByCandidateId = async (candidateId) => {
  if (!candidateId) return null;

  const result = await pool.query(
    `
    SELECT
      cv.id,
      cv.candidate_id,
      cv.file_url,
      cv.created_at,
      cv.is_default,
      cv.cv_text,
      cv.id_industry,
      cv.degree,
      cv.location,
      cv.exp_min,
      cv.exp_max,
      CASE
        WHEN i.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', i.id,
          'name', i.name,
          'description', i.description
        )
      END AS industry
    FROM cvs cv
    LEFT JOIN industry i ON i.id = cv.id_industry
    WHERE cv.candidate_id = $1
      AND COALESCE(cv.is_default, FALSE) = TRUE
    ORDER BY cv.created_at DESC, cv.id DESC
    LIMIT 1
    `,
    [candidateId],
  );

  return result.rows[0] || null;
};

const createCV = async ({ candidateId, fileUrl, isDefault }) => {
  await ensureCVTableDefaults();

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
        is_default,
        created_at
      )
      VALUES ($1, $2, $3, NOW())
      RETURNING ${selectCVFields}
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

const findIndustryIdByName = async (industryName) => {
  if (!industryName) return null;

  const result = await pool.query(
    `
    SELECT id
    FROM industry
    WHERE LOWER(name) = LOWER($1)
    ORDER BY id ASC
    LIMIT 1
    `,
    [industryName],
  );

  if (result.rows[0]?.id) {
    return result.rows[0].id;
  }

  const fuzzyResult = await pool.query(
    `
    SELECT id
    FROM industry
    WHERE name ILIKE $1 OR $2 ILIKE CONCAT('%', name, '%')
    ORDER BY LENGTH(name) DESC, id ASC
    LIMIT 1
    `,
    [`%${industryName}%`, industryName],
  );

  return fuzzyResult.rows[0]?.id || null;
};

const updateCVExtraction = async ({
  cvId,
  candidateId,
  cvText,
  industryId,
  degree,
  location,
  expMin,
  expMax,
}) => {
  const result = await pool.query(
    `
    UPDATE cvs
    SET
      cv_text = $3,
      id_industry = $4,
      degree = $5,
      location = $6,
      exp_min = $7,
      exp_max = $8
    WHERE id = $1 AND candidate_id = $2
    RETURNING ${selectCVFields}
    `,
    [cvId, candidateId, cvText, industryId, degree, location, expMin, expMax],
  );

  return result.rows[0];
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
      RETURNING ${selectCVFields}
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
      RETURNING ${selectCVFields}
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
  findDefaultCVByCandidateId,
  findIndustryIdByName,
  createCV,
  updateCVExtraction,
  setDefaultCV,
  deleteCVByIdAndCandidateId,
};
