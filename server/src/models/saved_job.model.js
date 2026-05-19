const pool = require("../config/db");

const saveJobForCandidate = async ({ candidateId, jobId }) => {
  if (!candidateId || !jobId) return null;

  const result = await pool.query(
    `
    WITH job_to_save AS (
      SELECT id
      FROM jobs
      WHERE id = $2
    ),
    existing_saved_job AS (
      SELECT
        id,
        candidate_id,
        job_id
      FROM saved_jobs
      WHERE candidate_id = $1
        AND job_id = $2
      ORDER BY id DESC
      LIMIT 1
    ),
    inserted_saved_job AS (
      INSERT INTO saved_jobs (
        candidate_id,
        job_id
      )
      SELECT
        $1,
        job_to_save.id
      FROM job_to_save
      WHERE NOT EXISTS (
        SELECT 1
        FROM existing_saved_job
      )
      RETURNING
        id,
        candidate_id,
        job_id
    )
    SELECT
      COALESCE(inserted_saved_job.id, existing_saved_job.id) AS id,
      COALESCE(
        inserted_saved_job.candidate_id,
        existing_saved_job.candidate_id
      ) AS candidate_id,
      COALESCE(inserted_saved_job.job_id, existing_saved_job.job_id) AS job_id,
      inserted_saved_job.id IS NOT NULL AS created
    FROM job_to_save
    LEFT JOIN existing_saved_job ON TRUE
    LEFT JOIN inserted_saved_job ON TRUE
    `,
    [candidateId, jobId],
  );

  return result.rows[0] || null;
};

const unsaveJobForCandidate = async ({ candidateId, jobId }) => {
  if (!candidateId || !jobId) return null;

  const result = await pool.query(
    `
    WITH deleted_saved_jobs AS (
      DELETE FROM saved_jobs
      WHERE candidate_id = $1
        AND job_id = $2
      RETURNING
        id,
        candidate_id,
        job_id
    )
    SELECT
      MAX(id) AS id,
      MAX(candidate_id) AS candidate_id,
      MAX(job_id) AS job_id,
      COUNT(*)::int AS deleted_count
    FROM deleted_saved_jobs
    `,
    [candidateId, jobId],
  );

  const deletedSavedJob = result.rows[0];

  if (!deletedSavedJob || deletedSavedJob.deleted_count === 0) {
    return null;
  }

  return deletedSavedJob;
};

const findSavedJobsByCandidateId = async (candidateId) => {
  if (!candidateId) return [];

  const result = await pool.query(
    `
    WITH latest_saved_jobs AS (
      SELECT DISTINCT ON (sj.job_id)
        sj.id AS saved_job_id,
        sj.candidate_id,
        sj.job_id
      FROM saved_jobs sj
      WHERE sj.candidate_id = $1
      ORDER BY sj.job_id, sj.id DESC
    )
    SELECT
      lsj.saved_job_id,
      lsj.candidate_id AS saved_candidate_id,
      TRUE AS is_saved,
      j.*,
      lt.name AS level_name,
      jt.name AS job_type_name,
      CASE
        WHEN lt.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', lt.id,
          'name', lt.name
        )
      END AS level,
      CASE
        WHEN jt.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', jt.id,
          'name', jt.name
        )
      END AS job_type,
      CASE
        WHEN c.company_id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'company_id', c.company_id,
          'name', c.name,
          'tax_code', c.tax_code,
          'description', c.description,
          'location', c.location,
          'url_website', c.url_website,
          'url_facebook', c.url_facebook,
          'logo', c.logo
        )
      END AS company,
      COALESCE(
        (
          SELECT jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', i.id,
              'name', i.name
            )
          )
          FROM job_industry ji
          INNER JOIN industry i ON i.id = ji.industry_id
          WHERE ji.job_id = j.id
        ),
        '[]'::jsonb
      ) AS industries
    FROM latest_saved_jobs lsj
    INNER JOIN jobs j ON j.id = lsj.job_id
    LEFT JOIN level_table lt ON lt.id = j.id_level
    LEFT JOIN job_type jt ON jt.id = j.job_type_id
    LEFT JOIN company c ON c.company_id = j.company_id
    ORDER BY lsj.saved_job_id DESC
    `,
    [candidateId],
  );

  return result.rows;
};

module.exports = {
  findSavedJobsByCandidateId,
  saveJobForCandidate,
  unsaveJobForCandidate,
};
