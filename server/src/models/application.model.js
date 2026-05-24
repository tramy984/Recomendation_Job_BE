const pool = require("../config/db");

const getApplicationById = async (applicationId, client = pool) => {
  if (!applicationId) return null;

  const result = await client.query(
    `
    SELECT
      a.id,
      a.candidate_id,
      a.cv_id,
      a.job_id,
      a.status,
      a.created_at,
      a.approved_at,
      a.reason_reject,
      CASE
        WHEN cv.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cv.id,
          'candidate_id', cv.candidate_id,
          'file_url', cv.file_url,
          'created_at', cv.created_at,
          'is_default', COALESCE(cv.is_default, FALSE)
        )
      END AS cv,
      CASE
        WHEN j.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', j.id,
          'name', j.name,
          'company_id', j.company_id,
          'recruiter_id', j.recruiter_id,
          'status', j.status,
          'expire', j.expire,
          'applied_number', COALESCE(j.applied_number, 0)
        )
      END AS job
    FROM applications a
    LEFT JOIN cvs cv ON cv.id = a.cv_id
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.id = $1
    `,
    [applicationId],
  );

  return result.rows[0] || null;
};

const applyJobForCandidate = async ({ candidateId, jobId, cvId = null }) => {
  if (!candidateId || !jobId) return null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const jobResult = await client.query(
      `
      SELECT
        id,
        status,
        expire
      FROM jobs
      WHERE id = $1
      FOR UPDATE
      `,
      [jobId],
    );

    const job = jobResult.rows[0];

    if (!job) {
      await client.query("ROLLBACK");
      return { error: "job_not_found" };
    }

    if (
      Number(job.status) !== 1 ||
      (job.expire && new Date(job.expire).getTime() <= Date.now())
    ) {
      await client.query("ROLLBACK");
      return { error: "job_not_open" };
    }

    const cvResult = await client.query(
      cvId
        ? `
          SELECT id
          FROM cvs
          WHERE id = $1
            AND candidate_id = $2
          `
        : `
          SELECT id
          FROM cvs
          WHERE candidate_id = $1
          ORDER BY is_default DESC, created_at DESC, id DESC
          LIMIT 1
          `,
      cvId ? [cvId, candidateId] : [candidateId],
    );

    const cv = cvResult.rows[0];

    if (!cv) {
      await client.query("ROLLBACK");
      return { error: "cv_not_found" };
    }

    const existingResult = await client.query(
      `
      SELECT id
      FROM applications
      WHERE candidate_id = $1
        AND job_id = $2
      ORDER BY id DESC
      LIMIT 1
      `,
      [candidateId, jobId],
    );

    const existingApplication = existingResult.rows[0];

    if (existingApplication) {
      const application = await getApplicationById(
        existingApplication.id,
        client,
      );

      await client.query("COMMIT");

      return {
        application,
        created: false,
      };
    }

    const applicationResult = await client.query(
      `
      INSERT INTO applications (
        candidate_id,
        cv_id,
        job_id,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id
      `,
      [candidateId, cv.id, jobId, "pending"],
    );

    await client.query(
      `
      UPDATE jobs
      SET applied_number = COALESCE(applied_number, 0) + 1
      WHERE id = $1
      `,
      [jobId],
    );

    const application = await getApplicationById(
      applicationResult.rows[0].id,
      client,
    );

    await client.query("COMMIT");

    return {
      application,
      created: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const findApplicationsByCandidateId = async (candidateId) => {
  if (!candidateId) return [];

  const result = await pool.query(
    `
    SELECT
      a.id,
      a.candidate_id,
      a.cv_id,
      a.job_id,
      a.status,
      a.created_at,
      a.approved_at,
      a.reason_reject,
      CASE
        WHEN cv.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cv.id,
          'candidate_id', cv.candidate_id,
          'file_url', cv.file_url,
          'created_at', cv.created_at,
          'is_default', COALESCE(cv.is_default, FALSE)
        )
      END AS cv,
      CASE
        WHEN j.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', j.id,
          'name', j.name,
          'description', j.description,
          'company_id', j.company_id,
          'recruiter_id', j.recruiter_id,
          'salary_min', j.salary_min,
          'salary_max', j.salary_max,
          'status', j.status,
          'created_at', j.created_at,
          'expire', j.expire,
          'location', j.location,
          'id_level', j.id_level,
          'job_type_id', j.job_type_id,
          'candidate_number', j.candidate_number,
          'exp_min', j.exp_min,
          'exp_max', j.exp_max,
          'job_benefit', j.job_benefit,
          'job_requirement', j.job_requirement,
          'applied_number', COALESCE(j.applied_number, 0),
          'level', CASE
            WHEN lt.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', lt.id,
              'name', lt.name
            )
          END,
          'job_type', CASE
            WHEN jt.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', jt.id,
              'name', jt.name
            )
          END,
          'company', CASE
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
          END,
          'industries', COALESCE(
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
          )
        )
      END AS job
    FROM applications a
    LEFT JOIN cvs cv ON cv.id = a.cv_id
    LEFT JOIN jobs j ON j.id = a.job_id
    LEFT JOIN level_table lt ON lt.id = j.id_level
    LEFT JOIN job_type jt ON jt.id = j.job_type_id
    LEFT JOIN company c ON c.company_id = j.company_id
    WHERE a.candidate_id = $1
    ORDER BY a.created_at DESC, a.id DESC
    `,
    [candidateId],
  );

  return result.rows;
};

module.exports = {
  applyJobForCandidate,
  findApplicationsByCandidateId,
};
