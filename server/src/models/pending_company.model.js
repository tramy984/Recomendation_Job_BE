const pool = require("../config/db");

const PENDING_COMPANY_FIELDS = `
  SELECT
    pc.id,
    pc.recruiter_id,
    jsonb_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'email', u.email,
      'full_name', r.full_name,
      'phone', r.phone,
      'gender', r.gender,
      'location', r.location,
      'date_of_birth', r.date_of_birth,
      'avatar', r.avatar,
      'company_id', r.company_id,
      'is_verify_phone', COALESCE(r.is_verify_phone, FALSE)
    ) AS recruiter,
    pc.name,
    pc.tax_code,
    pc.description,
    pc.location,
    pc.company_id,
    pc.reviewed_by,
    pc.url_website,
    pc.url_facebook,
    pc.logo,
    pc.certificate,
    pc.request_type,
    pc.status,
    pc.reject_reason,
    pc.created_at,
    pc.reviewed_at,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', i.id,
          'name', i.name
        )
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::jsonb
    ) AS industries
`;

const PENDING_COMPANY_GROUP_BY = `
    GROUP BY
      pc.id,
      pc.recruiter_id,
      r.id,
      r.user_id,
      r.full_name,
      r.phone,
      r.gender,
      r.location,
      r.date_of_birth,
      r.avatar,
      r.company_id,
      r.is_verify_phone,
      u.email,
      pc.name,
      pc.tax_code,
      pc.description,
      pc.location,
      pc.company_id,
      pc.reviewed_by,
      pc.url_website,
      pc.url_facebook,
      pc.logo,
      pc.certificate,
      pc.request_type,
      pc.status,
      pc.reject_reason,
      pc.created_at,
      pc.reviewed_at
`;

const getPendingCompanyById = async (pendingCompanyId, client = pool) => {
  if (!pendingCompanyId) return null;

  const result = await client.query(
    `
    ${PENDING_COMPANY_FIELDS}
    FROM pending_companies pc
    INNER JOIN recruiter r
      ON r.id = pc.recruiter_id
    LEFT JOIN users u
      ON u.id = r.user_id
    LEFT JOIN pending_company_industries pci
      ON pci.pending_company_id = pc.id
    LEFT JOIN industry i
      ON i.id = pci.industry_id
    WHERE pc.id = $1
    ${PENDING_COMPANY_GROUP_BY}
    `,
    [pendingCompanyId]
  );

  return result.rows[0] || null;
};

const getPendingCompaniesByRecruiterId = async (recruiterId) => {
  if (!recruiterId) return [];

  const result = await pool.query(
    `
    ${PENDING_COMPANY_FIELDS}
    FROM pending_companies pc
    INNER JOIN recruiter r
      ON r.id = pc.recruiter_id
    LEFT JOIN users u
      ON u.id = r.user_id
    LEFT JOIN pending_company_industries pci
      ON pci.pending_company_id = pc.id
    LEFT JOIN industry i
      ON i.id = pci.industry_id
    WHERE pc.recruiter_id = $1
    ${PENDING_COMPANY_GROUP_BY}
    ORDER BY pc.created_at DESC, pc.id DESC
    `,
    [recruiterId]
  );

  return result.rows;
};

const getPendingCompaniesByStatus = async (status = "pending") => {
  const result = await pool.query(
    `
    ${PENDING_COMPANY_FIELDS}
    FROM pending_companies pc
    INNER JOIN recruiter r
      ON r.id = pc.recruiter_id
    LEFT JOIN users u
      ON u.id = r.user_id
    LEFT JOIN pending_company_industries pci
      ON pci.pending_company_id = pc.id
    LEFT JOIN industry i
      ON i.id = pci.industry_id
    WHERE pc.status = $1
    ${PENDING_COMPANY_GROUP_BY}
    ORDER BY pc.created_at DESC, pc.id DESC
    `,
    [status]
  );

  return result.rows;
};

const getAllPendingCompanies = async () => {
  const result = await pool.query(
    `
    ${PENDING_COMPANY_FIELDS}
    FROM pending_companies pc
    INNER JOIN recruiter r
      ON r.id = pc.recruiter_id
    LEFT JOIN users u
      ON u.id = r.user_id
    LEFT JOIN pending_company_industries pci
      ON pci.pending_company_id = pc.id
    LEFT JOIN industry i
      ON i.id = pci.industry_id
    ${PENDING_COMPANY_GROUP_BY}
    ORDER BY pc.created_at DESC, pc.id DESC
    `
  );

  return result.rows;
};

const getApprovedCompanyById = async (companyId, client = pool) => {
  const result = await client.query(
    `
    SELECT
      c.company_id,
      c.name,
      c.tax_code,
      c.description,
      c.location,
      c.url_website,
      c.url_facebook,
      c.certificate,
      c.logo,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'id', i.id,
            'name', i.name
          )
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::jsonb
      ) AS industries
    FROM company c
    LEFT JOIN company_industry ci ON ci.id_company = c.company_id
    LEFT JOIN industry i ON i.id = ci.id_industry
    WHERE c.company_id = $1
    GROUP BY c.company_id
    `,
    [companyId]
  );

  return result.rows[0] || null;
};

const createPendingCompany = async ({
  recruiterId,
  name,
  taxCode = null,
  description = null,
  location = null,
  companyId = null,
  urlWebsite = null,
  urlFacebook = null,
  logo = null,
  certificate = null,
  requestType = "create",
  industryIds = [],
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM pending_company_industries
      WHERE pending_company_id IN (
        SELECT id
        FROM pending_companies
        WHERE recruiter_id = $1
      )
      `,
      [recruiterId]
    );

    await client.query(
      `
      DELETE FROM pending_companies
      WHERE recruiter_id = $1
      `,
      [recruiterId]
    );

    const pendingCompanyResult = await client.query(
      `
      INSERT INTO pending_companies (
        recruiter_id,
        name,
        tax_code,
        description,
        location,
        company_id,
        url_website,
        url_facebook,
        logo,
        certificate,
        request_type,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [
        recruiterId,
        name,
        taxCode,
        description,
        location,
        companyId,
        urlWebsite,
        urlFacebook,
        logo,
        certificate,
        requestType,
      ]
    );

    const pendingCompany = pendingCompanyResult.rows[0];

    if (industryIds.length > 0) {
      await client.query(
        `
        INSERT INTO pending_company_industries (
          pending_company_id,
          industry_id
        )
        SELECT $1, unnest($2::bigint[])
        `,
        [pendingCompany.id, industryIds]
      );
    }

    const createdPendingCompany = await getPendingCompanyById(
      pendingCompany.id,
      client
    );

    await client.query("COMMIT");

    return createdPendingCompany;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updatePendingCompany = async (
  pendingCompanyId,
  updateData = {},
  industryIds
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const fields = [
      { keys: ["name"], column: "name" },
      { keys: ["taxCode", "tax_code"], column: "tax_code" },
      { keys: ["description"], column: "description" },
      { keys: ["location"], column: "location" },
      { keys: ["companyId", "company_id"], column: "company_id" },
      { keys: ["urlWebsite", "url_website"], column: "url_website" },
      { keys: ["urlFacebook", "url_facebook"], column: "url_facebook" },
      { keys: ["logo"], column: "logo" },
      { keys: ["certificate"], column: "certificate" },
    ];

    const setClauses = [];
    const values = [];

    fields.forEach(({ keys, column }) => {
      const key = keys.find((fieldKey) =>
        Object.prototype.hasOwnProperty.call(updateData, fieldKey)
      );

      if (!key) return;

      values.push(updateData[key]);
      setClauses.push(`${column} = $${values.length}`);
    });

    if (setClauses.length > 0) {
      values.push(pendingCompanyId);

      await client.query(
        `
        UPDATE pending_companies
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length}
        `,
        values
      );
    }

    if (Array.isArray(industryIds)) {
      await client.query(
        `
        DELETE FROM pending_company_industries
        WHERE pending_company_id = $1
        `,
        [pendingCompanyId]
      );

      if (industryIds.length > 0) {
        await client.query(
          `
          INSERT INTO pending_company_industries (
            pending_company_id,
            industry_id
          )
          SELECT $1, unnest($2::bigint[])
          `,
          [pendingCompanyId, industryIds]
        );
      }
    }

    const updatedPendingCompany = await getPendingCompanyById(
      pendingCompanyId,
      client
    );

    await client.query("COMMIT");

    return updatedPendingCompany;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updatePendingCompanyCertificateByRecruiterId = async (
  recruiterId,
  certificate = null
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      WITH target_pending_company AS (
        SELECT id
        FROM pending_companies
        WHERE recruiter_id = $1
          AND status = 'pending'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      )
      UPDATE pending_companies pc
      SET certificate = $2
      FROM target_pending_company tpc
      WHERE pc.id = tpc.id
      RETURNING pc.id
      `,
      [recruiterId, certificate]
    );

    if (result.rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }

    const updatedPendingCompany = await getPendingCompanyById(
      result.rows[0].id,
      client
    );

    await client.query("COMMIT");

    return updatedPendingCompany;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const approvePendingCompany = async (pendingCompanyId, reviewedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pendingCompanyResult = await client.query(
      `
      SELECT *
      FROM pending_companies
      WHERE id = $1
      FOR UPDATE
      `,
      [pendingCompanyId]
    );

    const pendingCompany = pendingCompanyResult.rows[0];

    if (!pendingCompany) {
      await client.query("COMMIT");
      return null;
    }

    if (pendingCompany.status !== "pending") {
      const reviewedPendingCompany = await getPendingCompanyById(
        pendingCompanyId,
        client
      );

      await client.query("COMMIT");
      return {
        pendingCompany: reviewedPendingCompany,
        company: null,
        alreadyReviewed: true,
      };
    }

    const approvedPendingCompany = await getPendingCompanyById(
      pendingCompanyId,
      client
    );

    let companyId = pendingCompany.company_id;

    if (pendingCompany.request_type === "update") {
      if (!companyId) {
        await client.query("COMMIT");
        return {
          pendingCompany: approvedPendingCompany,
          company: null,
          invalidRequest: true,
        };
      }

      const existingCompanyResult = await client.query(
        `
        SELECT company_id
        FROM company
        WHERE company_id = $1
        FOR UPDATE
        `,
        [companyId]
      );

      if (existingCompanyResult.rows.length === 0) {
        await client.query("COMMIT");
        return {
          pendingCompany: approvedPendingCompany,
          company: null,
          invalidRequest: true,
        };
      }

      await client.query(
        `
        UPDATE company
        SET
          name = $1,
          tax_code = $2,
          description = $3,
          location = $4,
          url_website = $5,
          url_facebook = $6,
          certificate = $7,
          logo = $8
        WHERE company_id = $9
        `,
        [
          pendingCompany.name,
          pendingCompany.tax_code,
          pendingCompany.description,
          pendingCompany.location,
          pendingCompany.url_website,
          pendingCompany.url_facebook,
          pendingCompany.certificate,
          pendingCompany.logo,
          companyId,
        ]
      );

      await client.query(
        `
        DELETE FROM company_industry
        WHERE id_company = $1
        `,
        [companyId]
      );
    } else {
      const companyResult = await client.query(
        `
        INSERT INTO company (
          name,
          tax_code,
          description,
          location,
          url_website,
          url_facebook,
          certificate,
          logo
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING company_id
        `,
        [
          pendingCompany.name,
          pendingCompany.tax_code,
          pendingCompany.description,
          pendingCompany.location,
          pendingCompany.url_website,
          pendingCompany.url_facebook,
          pendingCompany.certificate,
          pendingCompany.logo,
        ]
      );

      companyId = companyResult.rows[0].company_id;
    }

    await client.query(
      `
      INSERT INTO company_industry (id_company, id_industry)
      SELECT $1, pci.industry_id
      FROM pending_company_industries pci
      WHERE pci.pending_company_id = $2
      `,
      [companyId, pendingCompanyId]
    );

    await client.query(
      `
      UPDATE recruiter
      SET company_id = $1
      WHERE id = $2
      `,
      [companyId, pendingCompany.recruiter_id]
    );

    await client.query(
      `
      DELETE FROM pending_company_industries
      WHERE pending_company_id = $1
      `,
      [pendingCompanyId]
    );

    await client.query(
      `
      DELETE FROM pending_companies
      WHERE id = $1
      `,
      [pendingCompanyId]
    );

    const approvedCompany = await getApprovedCompanyById(companyId, client);

    await client.query("COMMIT");

    return {
      pendingCompany: {
        ...approvedPendingCompany,
        status: "approved",
        reviewed_by: reviewedBy,
      },
      company: approvedCompany,
      alreadyReviewed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const rejectPendingCompany = async (
  pendingCompanyId,
  reviewedBy,
  rejectReason = null
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pendingCompanyResult = await client.query(
      `
      SELECT *
      FROM pending_companies
      WHERE id = $1
      FOR UPDATE
      `,
      [pendingCompanyId]
    );

    const pendingCompany = pendingCompanyResult.rows[0];

    if (!pendingCompany) {
      await client.query("COMMIT");
      return null;
    }

    const rejectedPendingCompany = await getPendingCompanyById(
      pendingCompanyId,
      client
    );

    await client.query(
      `
      DELETE FROM pending_company_industries
      WHERE pending_company_id = $1
      `,
      [pendingCompanyId]
    );

    await client.query(
      `
      DELETE FROM pending_companies
      WHERE id = $1
      `,
      [pendingCompanyId]
    );

    await client.query("COMMIT");

    return {
      pendingCompany: {
        ...rejectedPendingCompany,
        status: "rejected",
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        reject_reason: rejectReason,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  approvePendingCompany,
  createPendingCompany,
  getAllPendingCompanies,
  getPendingCompaniesByRecruiterId,
  getPendingCompanyById,
  getPendingCompaniesByStatus,
  rejectPendingCompany,
  updatePendingCompany,
  updatePendingCompanyCertificateByRecruiterId,
};
