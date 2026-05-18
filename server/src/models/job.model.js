const pool = require("../config/db");

const getJobsWithPagination = async ({ limit, offset }) => {
  const jobsQuery = `
    SELECT
      j.id,
      j.name,
      j.location,
      j.salary_min,
      j.salary_max,
      j.expire,

      jsonb_build_object(
        'logo',
        c.logo
      ) AS company,

      jsonb_build_object(
        'name',
        jt.name
      ) AS job_type

    FROM jobs j

    LEFT JOIN company c
      ON c.company_id = j.company_id

    LEFT JOIN job_type jt
      ON jt.id = j.job_type_id

    ORDER BY j.created_at DESC

    LIMIT $1 OFFSET $2
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM jobs
  `;

  const [jobsResult, countResult] = await Promise.all([
    pool.query(jobsQuery, [limit, offset]),
    pool.query(countQuery),
  ]);

  return {
    jobs: jobsResult.rows,
    total: countResult.rows[0]?.total || 0,
  };
};

module.exports = {
  getJobsWithPagination,
};
