const pool = require("../config/db");

const PENDING_COMPANY_FIELDS = `
  SELECT
    pc.id,
    pc.recruiter_id,
    pc.name,
    pc.tax_code,
    pc.description,
    pc.location,
    pc.reviewed_by,
    pc.url_website,
    pc.url_facebook,
    pc.logo,
    pc.certificate,
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

const getPendingCompanyById = async (pendingCompanyId, client = pool) => {
  if (!pendingCompanyId) return null;

  const result = await client.query(
    `
    ${PENDING_COMPANY_FIELDS}
    FROM pending_companies pc
    LEFT JOIN pending_company_industries pci
      ON pci.pending_company_id = pc.id
    LEFT JOIN industry i
      ON i.id = pci.industry_id
    WHERE pc.id = $1
    GROUP BY pc.id
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
    LEFT JOIN pending_company_industries pci
      ON pci.pending_company_id = pc.id
    LEFT JOIN industry i
      ON i.id = pci.industry_id
    WHERE pc.recruiter_id = $1
    GROUP BY pc.id
    ORDER BY pc.created_at DESC, pc.id DESC
    `,
    [recruiterId]
  );

  return result.rows;
};

const createPendingCompany = async ({
  recruiterId,
  name,
  taxCode = null,
  description = null,
  location = null,
  urlWebsite = null,
  urlFacebook = null,
  logo = null,
  certificate = null,
  industryIds = [],
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pendingCompanyResult = await client.query(
      `
      INSERT INTO pending_companies (
        recruiter_id,
        name,
        tax_code,
        description,
        location,
        url_website,
        url_facebook,
        logo,
        certificate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        recruiterId,
        name,
        taxCode,
        description,
        location,
        urlWebsite,
        urlFacebook,
        logo,
        certificate,
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

module.exports = {
  createPendingCompany,
  getPendingCompaniesByRecruiterId,
  getPendingCompanyById,
  updatePendingCompany,
  updatePendingCompanyCertificateByRecruiterId,
};
