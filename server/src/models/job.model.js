const pool = require("../config/db");

const getAllJobTypes = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      name
    FROM job_type
    ORDER BY id ASC
    `
  );

  return result.rows;
};

const getJobById = async (jobId, client = pool) => {
  if (!jobId) return null;

  const result = await client.query(
    `
    SELECT
      j.*,
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
    FROM jobs j
    WHERE j.id = $1
    `,
    [jobId]
  );

  return result.rows[0] || null;
};

const getJobsByCompanyId = async (companyId, filters = {}) => {
  if (!companyId) return [];

  const values = [companyId];
  const whereClauses = ["j.company_id = $1"];

  if (filters.name) {
    values.push(`%${filters.name}%`);
    whereClauses.push(`j.name ILIKE $${values.length}`);
  }

  if (filters.status !== undefined) {
    values.push(filters.status);
    whereClauses.push(`j.status = $${values.length}`);
  }

  if (filters.industryIds?.length > 0) {
    values.push(filters.industryIds);
    whereClauses.push(
      `
      EXISTS (
        SELECT 1
        FROM job_industry filter_ji
        WHERE filter_ji.job_id = j.id
          AND filter_ji.industry_id = ANY($${values.length}::bigint[])
      )
      `
    );
  }

  if (filters.industryName) {
    values.push(`%${filters.industryName}%`);
    whereClauses.push(
      `
      EXISTS (
        SELECT 1
        FROM job_industry filter_ji
        INNER JOIN industry filter_i
          ON filter_i.id = filter_ji.industry_id
        WHERE filter_ji.job_id = j.id
          AND filter_i.name ILIKE $${values.length}
      )
      `
    );
  }

  const result = await pool.query(
    `
    SELECT
      j.*,
      lt.name AS level_name,
      jt.name AS job_type_name,
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
    FROM jobs j
    LEFT JOIN level_table lt ON lt.id = j.id_level
    LEFT JOIN job_type jt ON jt.id = j.job_type_id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY j.created_at DESC, j.id DESC
    `,
    values
  );

  return result.rows;
};

const updateJobStatusById = async (jobId, status, client = pool) => {
  if (!jobId) return null;

  const result = await client.query(
    `
    UPDATE jobs
    SET status = $2
    WHERE id = $1
    RETURNING id
    `,
    [jobId, status]
  );

  if (!result.rows[0]) return null;

  return getJobById(result.rows[0].id, client);
};

const updateJobExpireById = async (
  jobId,
  expire,
  status,
  client = pool
) => {
  if (!jobId) return null;

  const result = await client.query(
    `
    UPDATE jobs
    SET
      expire = $2,
      status = $3
    WHERE id = $1
    RETURNING id
    `,
    [jobId, expire, status]
  );

  if (!result.rows[0]) return null;

  return getJobById(result.rows[0].id, client);
};

const updateExpiredJobsStatus = async () => {
  const result = await pool.query(
    `
    UPDATE jobs
    SET status = 2
    WHERE expire IS NOT NULL
      AND expire <= CURRENT_TIMESTAMP
      AND COALESCE(status, -1) <> 2
    RETURNING id
    `
  );

  return result.rows;
};

const createJob = async ({
  name,
  description,
  companyId,
  recruiterId,
  salaryMin,
  salaryMax,
  status,
  expire,
  location,
  levelId,
  jobTypeId,
  candidateNumber,
  expMin,
  expMax,
  jobBenefit,
  jobRequirement,
  industryIds = [],
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO jobs (
        name,
        description,
        company_id,
        recruiter_id,
        salary_min,
        salary_max,
        status,
        expire,
        location,
        id_level,
        job_type_id,
        candidate_number,
        exp_min,
        exp_max,
        job_benefit,
        job_requirement
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
      `,
      [
        name,
        description,
        companyId,
        recruiterId,
        salaryMin,
        salaryMax,
        status,
        expire,
        location,
        levelId,
        jobTypeId,
        candidateNumber,
        expMin,
        expMax,
        jobBenefit,
        jobRequirement,
      ]
    );

    const job = result.rows[0];

    if (industryIds.length > 0) {
      await client.query(
        `
        INSERT INTO job_industry (
          job_id,
          industry_id
        )
        SELECT $1, unnest($2::bigint[])
        `,
        [job.id, industryIds]
      );
    }

    const createdJob = await getJobById(job.id, client);

    await client.query("COMMIT");

    return createdJob;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createJob,
  getJobById,
  getJobsByCompanyId,
  updateExpiredJobsStatus,
  updateJobExpireById,
  updateJobStatusById,
  getAllJobTypes,
};
