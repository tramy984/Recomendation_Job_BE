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
  getAllJobTypes,
};
