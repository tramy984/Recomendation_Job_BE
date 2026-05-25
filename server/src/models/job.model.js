const pool = require("../config/db");

const getAllJobTypes = async () => {
  const result = await pool.query(
    `
    SELECT
      id,
      name
    FROM job_type
    ORDER BY id ASC
    `,
  );

  return result.rows;
};

const getJobById = async (jobId, client = pool) => {
  if (!jobId) return null;

  const result = await client.query(
    `
    SELECT
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
          'logo', c.logo,
          'industries', COALESCE(
            (
              SELECT jsonb_agg(
                DISTINCT jsonb_build_object(
                  'id', ci_i.id,
                  'name', ci_i.name
                )
              )
              FROM company_industry ci
              INNER JOIN industry ci_i ON ci_i.id = ci.id_industry
              WHERE ci.id_company = c.company_id
            ),
            '[]'::jsonb
          )
        )
      END AS company,
      CASE
        WHEN r.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', r.id,
          'full_name', r.full_name,
          'phone', r.phone,
          'avatar', r.avatar,
          'is_verify_phone', COALESCE(r.is_verify_phone, FALSE)
        )
      END AS recruiter,
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
    LEFT JOIN company c ON c.company_id = j.company_id
    LEFT JOIN recruiter r ON r.id = j.recruiter_id
    WHERE j.id = $1
    `,
    [jobId],
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
      `,
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
      `,
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
    values,
  );

  return result.rows;
};

const getJobsByRecruiterId = async (recruiterId, filters = {}) => {
  if (!recruiterId) return [];

  const values = [recruiterId];
  const whereClauses = ["j.recruiter_id = $1"];

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
      `,
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
      `,
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
    values,
  );

  return result.rows;
};

const getJobApplicationsByJobId = async (jobId) => {
  if (!jobId) return [];

  const result = await pool.query(
    `
    SELECT
      a.id,
      a.job_id,
      a.candidate_id,
      a.cv_id,
      a.status,
      a.created_at,
      a.approved_at,
      a.reason_reject,
      CASE
        WHEN cp.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cp.id,
          'user_id', cp.user_id,
          'full_name', cp.full_name,
          'phone', cp.phone,
          'location', cp.location,
          'gender', cp.gender,
          'date_of_birth', cp.date_of_birth,
          'avatar', cp.avatar,
          'email', u.email,
          'user_status', u.status
        )
      END AS candidate,
      CASE
        WHEN cv.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cv.id,
          'candidate_id', cv.candidate_id,
          'file_url', cv.file_url,
          'created_at', cv.created_at,
          'is_default', COALESCE(cv.is_default, FALSE)
        )
      END AS cv
    FROM applications a
    LEFT JOIN candidate_profile cp ON cp.id = a.candidate_id
    LEFT JOIN users u ON u.id = cp.user_id
    LEFT JOIN cvs cv ON cv.id = a.cv_id
    WHERE a.job_id = $1
    ORDER BY a.created_at DESC, a.id DESC
    `,
    [jobId],
  );

  return result.rows;
};

const getApplicationById = async (applicationId) => {
  if (!applicationId) return null;

  const result = await pool.query(
    `
    SELECT
      a.id,
      a.job_id,
      a.candidate_id,
      a.cv_id,
      a.status,
      a.created_at,
      a.approved_at,
      a.reason_reject,
      CASE
        WHEN j.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', j.id,
          'name', j.name,
          'company_id', j.company_id,
          'recruiter_id', j.recruiter_id,
          'status', j.status
        )
      END AS job,
      CASE
        WHEN cp.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cp.id,
          'user_id', cp.user_id,
          'full_name', cp.full_name,
          'phone', cp.phone,
          'location', cp.location,
          'gender', cp.gender,
          'date_of_birth', cp.date_of_birth,
          'avatar', cp.avatar,
          'email', u.email,
          'user_status', u.status
        )
      END AS candidate,
      CASE
        WHEN cv.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', cv.id,
          'candidate_id', cv.candidate_id,
          'file_url', cv.file_url,
          'created_at', cv.created_at,
          'is_default', COALESCE(cv.is_default, FALSE)
        )
      END AS cv
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    LEFT JOIN candidate_profile cp ON cp.id = a.candidate_id
    LEFT JOIN users u ON u.id = cp.user_id
    LEFT JOIN cvs cv ON cv.id = a.cv_id
    WHERE a.id = $1
    `,
    [applicationId],
  );

  return result.rows[0] || null;
};
const updateApplicationReviewById = async ({
  applicationId,
  status,
  reasonReject = null,
}) => {
  if (!applicationId) return null;

  const result = await pool.query(
    `
    UPDATE applications
    SET
      status = $2::varchar,
      approved_at = CASE
        WHEN $2::varchar = 'approved' THEN CURRENT_TIMESTAMP
        ELSE NULL
      END,
      reason_reject = $3
    WHERE id = $1
    RETURNING id
    `,
    [applicationId, status, reasonReject],
  );

  if (!result.rows[0]) return null;

  return getApplicationById(result.rows[0].id);
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
    [jobId, status],
  );

  if (!result.rows[0]) return null;

  return getJobById(result.rows[0].id, client);
};

const updateJobExpireById = async (jobId, expire, status, client = pool) => {
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
    [jobId, expire, status],
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
    `,
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
        created_at,
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
        $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP,
        $8, $9, $10, $11, $12, $13, $14, $15, $16
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
      ],
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
        [job.id, industryIds],
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
const updateJobById = async ({
  jobId,
  name,
  description,
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
  if (!jobId) return null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE jobs
      SET
        name = $2,
        description = $3,
        salary_min = $4,
        salary_max = $5,
        status = $6,
        expire = $7,
        location = $8,
        id_level = $9,
        job_type_id = $10,
        candidate_number = $11,
        exp_min = $12,
        exp_max = $13,
        job_benefit = $14,
        job_requirement = $15
      WHERE id = $1
      RETURNING id
      `,
      [
        jobId,
        name,
        description,
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
      ],
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      DELETE FROM job_industry
      WHERE job_id = $1
      `,
      [jobId],
    );

    if (Array.isArray(industryIds) && industryIds.length > 0) {
      await client.query(
        `
        INSERT INTO job_industry (
          job_id,
          industry_id
        )
        SELECT $1, unnest($2::bigint[])
        `,
        [jobId, industryIds],
      );
    }

    const updatedJob = await getJobById(jobId, client);

    await client.query("COMMIT");

    return updatedJob;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
const getJobsWithPagination = async ({
  limit,
  offset,
  name,
  industryId,
  status,
  jobTypeId,
  levelId,
  salaryMin,
  salaryMax,
  expMin,
  expMax,
}) => {
  const values = [];
  const where = [];

  if (name) {
    values.push(`%${name}%`);
    where.push(`
      (
        j.name ILIKE $${values.length}
        OR j.location ILIKE $${values.length}
        OR c.name ILIKE $${values.length}
      )
    `);
  }

  if (industryId) {
    values.push(industryId);
    where.push(`
      EXISTS (
        SELECT 1
        FROM job_industry ji
        WHERE ji.job_id = j.id
          AND ji.industry_id = $${values.length}
      )
    `);
  }

  if (status !== undefined && status !== "") {
    values.push(status);
    where.push(`j.status = $${values.length}`);
  }

  if (jobTypeId) {
    values.push(jobTypeId);
    where.push(`j.job_type_id = $${values.length}`);
  }

  if (levelId) {
    values.push(levelId);
    where.push(`j.id_level = $${values.length}`);
  }

  if (salaryMin) {
    values.push(salaryMin);
    where.push(`j.salary_max >= $${values.length}`);
  }

  if (salaryMax) {
    values.push(salaryMax);
    where.push(`j.salary_min <= $${values.length}`);
  }

  if (expMin) {
    values.push(expMin);
    where.push(`j.exp_max >= $${values.length}`);
  }

  if (expMax) {
    values.push(expMax);
    where.push(`j.exp_min <= $${values.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const filterValues = [...values];

  values.push(limit);
  const limitIndex = values.length;

  values.push(offset);
  const offsetIndex = values.length;

  const baseFrom = `
    FROM jobs j
    LEFT JOIN company c ON c.company_id = j.company_id
    LEFT JOIN job_type jt ON jt.id = j.job_type_id
  `;

  const jobsQuery = `
    SELECT
      j.id,
      j.name,
      j.location,
      j.salary_min,
      j.salary_max,
      j.expire,

      jsonb_build_object(
        'logo', c.logo
      ) AS company,

      jsonb_build_object(
        'name', jt.name
      ) AS job_type

    ${baseFrom}

    ${whereSql}

    ORDER BY j.created_at DESC, j.id DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    ${baseFrom}
    ${whereSql}
  `;

  const [jobsResult, countResult] = await Promise.all([
    pool.query(jobsQuery, values),
    pool.query(countQuery, filterValues),
  ]);

  return {
    jobs: jobsResult.rows,
    total: countResult.rows[0]?.total || 0,
  };
};
module.exports = {
  createJob,
  getApplicationById,
  getJobApplicationsByJobId,
  getJobById,
  getJobsByCompanyId,
  getJobsByRecruiterId,
  updateApplicationReviewById,
  updateExpiredJobsStatus,
  updateJobExpireById,
  updateJobStatusById,
  getAllJobTypes,
  updateJobById,
  getJobsWithPagination,
};
