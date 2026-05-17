const {
  getAllCompanies,
  getCompanyById,
  getCompaniesByExactName,
  getCompaniesByName,
  getCompanyByRecruiterUserId,
} = require("../models/company.model");

const {
  approvePendingCompany,
  createPendingCompany,
  getPendingCompaniesByRecruiterId,
  getPendingCompanyById,
  getPendingCompaniesByStatus,
  updatePendingCompany,
  updatePendingCompanyCertificateByRecruiterId,
} = require("../models/pending_company.model");

const { getRecruiterByUserId } = require("../models/recruiter.model");

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const getPendingCompanyPayload = (body = {}) => {
  if (body.pendingCompany) return { ...body.pendingCompany };
  if (!body.data) return { ...body };
  if (body.data.pendingCompany) return { ...body.data.pendingCompany };
  return { ...body.data };
};

const normalizeIndustryIds = (value) => {
  const rawIds = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      rawIds
        .flatMap((item) => {
          if (typeof item === "string") return item.split(",");
          return [item];
        })
        .map((item) => String(item || "").trim())
        .filter(isValidId)
        .map(Number)
    ),
  ];
};

const hasOwn = (data, key) => {
  return Object.prototype.hasOwnProperty.call(data, key);
};

const hasAnyOwn = (data, keys) => {
  return keys.some((key) => hasOwn(data, key));
};

const normalizeOptionalText = (value) => {
  if (typeof value !== "string") return value ?? null;

  const trimmedValue = value.trim();

  return trimmedValue || null;
};

const getPendingCompanyCertificateUrl = (file) => {
  if (!file) return null;

  return `/uploads/pending-companies/certificates/${file.filename}`;
};

const getPublicUrl = (req, value) => {
  if (!value || typeof value !== "string") return value || null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${req.protocol}://${req.get("host")}${value}`;
  }

  return value;
};

const formatPendingCompanyResponse = (req, pendingCompany) => {
  if (!pendingCompany) return null;

  return {
    ...pendingCompany,
    logo: getPublicUrl(req, pendingCompany.logo),
    certificate: getPublicUrl(req, pendingCompany.certificate),
  };
};

const formatPendingCompaniesResponse = (req, pendingCompanies = []) => {
  return pendingCompanies.map((pendingCompany) =>
    formatPendingCompanyResponse(req, pendingCompany)
  );
};

const formatCompanyResponse = (req, company) => {
  if (!company) return null;

  return {
    ...company,
    logo: getPublicUrl(req, company.logo),
    certificate: getPublicUrl(req, company.certificate),
  };
};

const getCompanies = async (req, res) => {
  try {
    const companies = await getAllCompanies();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách công ty thành công.",
      data: {
        companies,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách công ty:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const searchCompaniesByName = async (req, res) => {
  try {
    const { name } = req.query;
    const keyword = typeof name === "string" ? name.trim() : "";

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "Tên công ty không được để trống.",
      });
    }

    const companies = await getCompaniesByName(keyword);

    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin công ty.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin công ty thành công.",
      data: {
        companies,
      },
    });
  } catch (error) {
    console.error("Lỗi tìm công ty theo tên:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getCompaniesByNameFromCompanyTable = async (req, res) => {
  try {
    const { name } = req.query;
    const keyword = typeof name === "string" ? name.trim() : "";

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "Tên công ty không được để trống.",
      });
    }

    const companies = await getCompaniesByExactName(keyword);

    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin công ty.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin công ty theo tên thành công.",
      data: {
        companies: companies.map((company) =>
          formatCompanyResponse(req, company)
        ),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin công ty theo tên:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getMyPendingCompanies = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền truy cập thông tin này.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const pendingCompanies = await getPendingCompaniesByRecruiterId(
      recruiter.id
    );

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách yêu cầu công ty thành công.",
      data: {
        pendingCompanies: formatPendingCompaniesResponse(
          req,
          pendingCompanies
        ),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy yêu cầu công ty theo nhà tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getPendingCompaniesWaitingConfirmation = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền truy cập thông tin này.",
      });
    }

    const pendingCompanies = await getPendingCompaniesByStatus("pending");

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách công ty chờ xác nhận thành công.",
      data: {
        pendingCompanies: formatPendingCompaniesResponse(
          req,
          pendingCompanies
        ),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách công ty chờ xác nhận:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const approvePendingCompanyRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { pendingCompanyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền xác nhận công ty.",
      });
    }

    if (!isValidId(pendingCompanyId)) {
      return res.status(400).json({
        success: false,
        message: "pendingCompanyId không hợp lệ.",
      });
    }

    const result = await approvePendingCompany(pendingCompanyId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu công ty.",
      });
    }

    if (result.alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu công ty này đã được xử lý.",
        data: {
          pendingCompany: formatPendingCompanyResponse(
            req,
            result.pendingCompany
          ),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xác nhận công ty thành công.",
      data: {
        company: formatCompanyResponse(req, result.company),
        pendingCompany: formatPendingCompanyResponse(
          req,
          result.pendingCompany
        ),
      },
    });
  } catch (error) {
    console.error("Lỗi xác nhận công ty chờ duyệt:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const updatePendingCompanyRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { pendingCompanyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền cập nhật yêu cầu này.",
      });
    }

    if (!isValidId(pendingCompanyId)) {
      return res.status(400).json({
        success: false,
        message: "pendingCompanyId không hợp lệ.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const currentPendingCompany = await getPendingCompanyById(
      pendingCompanyId
    );

    if (!currentPendingCompany) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu công ty.",
      });
    }

    if (
      Number(currentPendingCompany.recruiter_id) !==
      Number(recruiter.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền cập nhật yêu cầu công ty này.",
      });
    }

    if (currentPendingCompany.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể cập nhật yêu cầu công ty đang chờ duyệt.",
      });
    }

    const payload = getPendingCompanyPayload(req.body);
    const updateData = {};

    if (hasOwn(payload, "name")) {
      const name = normalizeOptionalText(payload.name);

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Tên công ty không được để trống.",
        });
      }

      updateData.name = name;
    }

    if (hasAnyOwn(payload, ["taxCode", "tax_code"])) {
      updateData.taxCode = normalizeOptionalText(
        hasOwn(payload, "taxCode") ? payload.taxCode : payload.tax_code
      );
    }

    if (hasOwn(payload, "description")) {
      updateData.description = normalizeOptionalText(payload.description);
    }

    if (hasOwn(payload, "location")) {
      updateData.location = normalizeOptionalText(payload.location);
    }

    if (hasAnyOwn(payload, ["urlWebsite", "url_website"])) {
      updateData.urlWebsite = normalizeOptionalText(
        hasOwn(payload, "urlWebsite")
          ? payload.urlWebsite
          : payload.url_website
      );
    }

    if (hasAnyOwn(payload, ["urlFacebook", "url_facebook"])) {
      updateData.urlFacebook = normalizeOptionalText(
        hasOwn(payload, "urlFacebook")
          ? payload.urlFacebook
          : payload.url_facebook
      );
    }

    if (hasOwn(payload, "logo")) {
      updateData.logo = normalizeOptionalText(payload.logo);
    }

    if (
      hasAnyOwn(payload, [
        "certificate",
        "certificateUrl",
        "certificate_url",
      ])
    ) {
      updateData.certificate = normalizeOptionalText(
        payload.certificate ??
          payload.certificateUrl ??
          payload.certificate_url
      );
    }

    const hasIndustryIds = hasAnyOwn(payload, [
      "industryIds",
      "industry_ids",
    ]);

    const industryIds = hasIndustryIds
      ? normalizeIndustryIds(payload.industryIds || payload.industry_ids)
      : undefined;

    if (hasIndustryIds && industryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 lĩnh vực hoạt động của công ty.",
      });
    }

    if (Object.keys(updateData).length === 0 && !hasIndustryIds) {
      return res.status(400).json({
        success: false,
        message: "Không có dữ liệu để cập nhật.",
      });
    }

    const pendingCompany = await updatePendingCompany(
      pendingCompanyId,
      updateData,
      industryIds
    );

    return res.status(200).json({
      success: true,
      message: "Cập nhật yêu cầu công ty thành công.",
      data: {
        pendingCompany: formatPendingCompanyResponse(req, pendingCompany),
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật yêu cầu công ty:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const updatePendingCompanyCertificate = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message:
          "Tài khoản của bạn không có quyền cập nhật giấy chứng nhận.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const uploadedCertificate = getPendingCompanyCertificateUrl(req.file);
    const payload = getPendingCompanyPayload(req.body);

    const hasCertificate =
      Boolean(uploadedCertificate) ||
      hasAnyOwn(payload, [
        "certificate",
        "certificateUrl",
        "certificate_url",
      ]);

    if (!hasCertificate) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng truyền giấy chứng nhận.",
      });
    }

    const certificate =
      uploadedCertificate ||
      normalizeOptionalText(
        payload.certificate ??
          payload.certificateUrl ??
          payload.certificate_url
      );

    const pendingCompany =
      await updatePendingCompanyCertificateByRecruiterId(
        recruiter.id,
        certificate
      );

    if (!pendingCompany) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu công ty đang chờ duyệt.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật giấy chứng nhận thành công.",
      data: {
        pendingCompany: formatPendingCompanyResponse(req, pendingCompany),
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật giấy chứng nhận công ty chờ duyệt:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const createPendingCompanyRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền này.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const payload = getPendingCompanyPayload(req.body);
    const name = typeof payload.name === "string" ? payload.name.trim() : "";

    const rawCertificate =
      payload.certificate ??
      payload.certificateUrl ??
      payload.certificate_url;

    const certificate =
      typeof rawCertificate === "string"
        ? rawCertificate.trim() || null
        : rawCertificate || null;

    const industryIds = normalizeIndustryIds(
      payload.industryIds || payload.industry_ids
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên công ty không được để trống.",
      });
    }

    if (industryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 lĩnh vực hoạt động của công ty.",
      });
    }

    const pendingCompany = await createPendingCompany({
      recruiterId: recruiter.id,
      name,
      taxCode: payload.taxCode || payload.tax_code || null,
      description: payload.description || null,
      location: payload.location || null,
      urlWebsite: payload.urlWebsite || payload.url_website || null,
      urlFacebook: payload.urlFacebook || payload.url_facebook || null,
      logo: payload.logo || null,
      certificate,
      industryIds,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo yêu cầu thành công.",
      data: {
        pendingCompany: formatPendingCompanyResponse(req, pendingCompany),
      },
    });
  } catch (error) {
    console.error("Lỗi tạo yêu cầu công ty:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getCompanyDetail = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!isValidId(companyId)) {
      return res.status(400).json({
        success: false,
        message: "companyId không hợp lệ.",
      });
    }

    const company = await getCompanyById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin công ty.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin công ty thành công.",
      data: {
        company,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin công ty:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getMyCompany = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền truy cập thông tin này.",
      });
    }

    const company = await getCompanyByRecruiterUserId(userId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Nhà tuyển dụng chưa liên kết với công ty.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin công ty thành công.",
      data: {
        company,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin công ty của nhà tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  approvePendingCompanyRequest,
  createPendingCompanyRequest,
  getCompanies,
  getCompanyDetail,
  getCompaniesByNameFromCompanyTable,
  getMyPendingCompanies,
  getMyCompany,
  getPendingCompaniesWaitingConfirmation,
  searchCompaniesByName,
  updatePendingCompanyCertificate,
  updatePendingCompanyRequest,
};
