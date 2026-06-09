const {
  findCandidateById,
  findCandidateByUserId,
  updateCandidateByUserId,
} = require("../models/candidate.model");
const { findDefaultCVByCandidateId } = require("../models/cv.model");
const {
  findRecommendedJobsByIdsAndIndustry,
  findRecommendedJobsByIdsWithIndustryPriority,
} = require("../models/job.model");
const {
  applyJobForCandidate,
  findApplicationsByCandidateId,
} = require("../models/application.model");
const {
  findSavedJobsByCandidateId,
  saveJobForCandidate,
  unsaveJobForCandidate,
} = require("../models/saved_job.model");
const {
  notifyJobApplicationCountIfNeeded,
} = require("../services/notification.service");
const {
  deleteFileFromStorage,
  uploadFileToStorage,
} = require("../services/storage.service");
const {
  recommendFullPosNegJobsByCVText,
  recommendJobsByCVText,
  rerankRecommendedJobs,
} = require("../services/recommend.service");

const removeLocalUploadedFile = async (file) => {
  if (!file?.path) return;

  try {
    const fs = require("fs");
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("DELETE LOCAL UPLOAD ERROR:", error);
    }
  }
};

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const buildRecommendedJobInputs = (recommendedJobs) => {
  const seenJobIds = new Set();
  const jobIds = [];
  const scores = [];

  recommendedJobs.forEach((job) => {
    const jobId = job?.jobId;

    if (!isValidId(jobId) || seenJobIds.has(Number(jobId))) {
      return;
    }

    seenJobIds.add(Number(jobId));
    jobIds.push(Number(jobId));
    scores.push(Number.isFinite(Number(job.score)) ? Number(job.score) : null);
  });

  return {
    jobIds,
    scores,
  };
};

const getRerankedRecommendedJobs = async ({
  recommendedJobs,
  industryId,
  candidate,
  cv,
}) => {
  const { jobIds, scores } = buildRecommendedJobInputs(recommendedJobs);
  const jobs = await findRecommendedJobsByIdsWithIndustryPriority({
    jobIds,
    scores,
    industryId,
  });

  return rerankRecommendedJobs({
    jobs,
    candidate,
    cv,
  });
};

const getMyCandidate = async (req, res) => {
  try {
    const userId = req.user.id;

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      if (avatar) {
        await deleteFileFromStorage(avatar);
      }

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy candidate thành công.",
      data: candidate,
    });
  } catch (error) {
    console.log("GET MY CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
    });
  }
};

const getCandidateDetail = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới có quyền xem hồ sơ ứng viên.",
      });
    }

    const { candidateId } = req.params;

    if (!isValidId(candidateId)) {
      return res.status(400).json({
        success: false,
        message: "candidateId không hợp lệ.",
      });
    }

    const candidate = await findCandidateById(candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    return res.status(200).json({
      candidate,
    });
  } catch (error) {
    console.log("GET CANDIDATE DETAIL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
    });
  }
};

const updateMyCandidate = async (req, res) => {
  try {
    const userId = req.user.id;

    const { fullName, phone, location, gender, dateOfBirth, removeAvatar } =
      req.body;

    let avatar;
    let updateAvatar = false;

    if (req.file) {
      avatar = await uploadFileToStorage({
        file: req.file,
        folder: `candidate-avatars/${userId}`,
      });

      await removeLocalUploadedFile(req.file);

      updateAvatar = true;
    }

    if (removeAvatar === "true") {
      avatar = null;
      updateAvatar = true;
    }

    const candidate = await updateCandidateByUserId({
      userId,
      fullName,
      phone,
      location,
      gender,
      dateOfBirth,
      avatar,
      updateAvatar,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công.",
      data: candidate,
    });
  } catch (error) {
    if (req.file) {
      await removeLocalUploadedFile(req.file);
    }

    console.log("UPDATE MY CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Cập nhật thông tin thất bại.",
    });
  }
};

const getMySavedJobs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm đã lưu.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const jobs = await findSavedJobsByCandidateId(candidate.id);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm đã lưu thành công.",
      data: {
        candidateId: candidate.id,
        total: jobs.length,
        jobs,
      },
    });
  } catch (error) {
    console.log("GET MY SAVED JOBS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const getMyRecommendedJobs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm gợi ý.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const defaultCV = await findDefaultCVByCandidateId(candidate.id);

    if (!defaultCV) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa có CV mặc định.",
      });
    }

    if (!defaultCV.cv_text) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có nội dung để gợi ý việc làm.",
      });
    }

    if (!defaultCV.id_industry) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có ngành nghề để lọc việc làm phù hợp.",
      });
    }

    const recommendedJobs = await recommendJobsByCVText({
      cvText: defaultCV.cv_text,
    });
    console.log(
      `Recommended ${recommendedJobs.length} jobs for candidate ${candidate.id} with CV ${defaultCV.id}`,
    );
    const { jobIds, scores } = buildRecommendedJobInputs(recommendedJobs);

    const jobs = await findRecommendedJobsByIdsAndIndustry({
      jobIds,
      scores,
      industryId: defaultCV.id_industry,
    });
    const rerankedJobs = rerankRecommendedJobs({
      jobs,
      candidate,
      cv: defaultCV,
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm gợi ý thành công.",
      data: {
        candidateId: candidate.id,
        cv: {
          id: defaultCV.id,
          industryId: defaultCV.id_industry,
          industry: defaultCV.industry,
        },
        totalRecommended: recommendedJobs.length,
        total: rerankedJobs.length,
        jobs: rerankedJobs,
      },
    });
  } catch (error) {
    console.log("GET MY RECOMMENDED JOBS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const getMyRecommendedJobsFullPosNeg = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm gợi ý.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const defaultCV = await findDefaultCVByCandidateId(candidate.id);

    if (!defaultCV) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa có CV mặc định.",
      });
    }

    if (!defaultCV.cv_text) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có nội dung để gợi ý việc làm.",
      });
    }

    if (!defaultCV.id_industry) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có ngành nghề để lọc việc làm phù hợp.",
      });
    }

    const recommendationResult = await recommendFullPosNegJobsByCVText({
      cvText: defaultCV.cv_text,
      threshold: req.query?.threshold,
    });

    console.log(
      `Recommended ${recommendationResult.total} full pos neg jobs for candidate ${candidate.id} with CV ${defaultCV.id}`,
    );

    const [rerankedPosJobs, rerankedNegJobs] = await Promise.all([
      getRerankedRecommendedJobs({
        recommendedJobs: recommendationResult.pos,
        industryId: defaultCV.id_industry,
        candidate,
        cv: defaultCV,
      }),
      getRerankedRecommendedJobs({
        recommendedJobs: recommendationResult.neg,
        industryId: defaultCV.id_industry,
        candidate,
        cv: defaultCV,
      }),
    ]);

    const allJobs = [...rerankedPosJobs, ...rerankedNegJobs];

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm gợi ý pos/neg thành công.",
      data: {
        candidateId: candidate.id,
        cv: {
          id: defaultCV.id,
          industryId: defaultCV.id_industry,
          industry: defaultCV.industry,
        },
        threshold: recommendationResult.threshold,
        totalRecommended: recommendationResult.total,
        totalPositive: rerankedPosJobs.length,
        totalNegative: rerankedNegJobs.length,
        total: rerankedPosJobs.length,
        jobs: rerankedPosJobs,
        pos: rerankedPosJobs,
        neg: rerankedNegJobs,
        allJobs,
      },
    });
  } catch (error) {
    console.log("GET MY RECOMMENDED JOBS FULL POS NEG ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const saveMyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền lưu việc làm.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const savedJob = await saveJobForCandidate({
      candidateId: candidate.id,
      jobId,
    });

    if (!savedJob) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy việc làm.",
      });
    }

    return res.status(savedJob.created ? 201 : 200).json({
      success: true,
      message: savedJob.created
        ? "Lưu việc làm thành công."
        : "Việc làm này đã được lưu trước đó.",
      data: {
        savedJob,
      },
    });
  } catch (error) {
    console.log("SAVE MY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const unsaveMyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền bỏ lưu việc làm.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const unsavedJob = await unsaveJobForCandidate({
      candidateId: candidate.id,
      jobId,
    });

    if (!unsavedJob) {
      return res.status(404).json({
        success: false,
        message: "Việc làm này chưa được lưu.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bỏ lưu việc làm thành công.",
      data: {
        unsavedJob,
      },
    });
  } catch (error) {
    console.log("UNSAVE MY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const applyMyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;
    const { cvId } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền ứng tuyển việc làm.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    if (
      cvId !== undefined &&
      cvId !== null &&
      cvId !== "" &&
      !isValidId(cvId)
    ) {
      return res.status(400).json({
        success: false,
        message: "cvId không hợp lệ.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const result = await applyJobForCandidate({
      candidateId: candidate.id,
      jobId,
      cvId: cvId || null,
    });

    if (!result || result.error === "job_not_found") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy việc làm.",
      });
    }

    if (result.error === "job_not_open") {
      return res.status(400).json({
        success: false,
        message: "Tin tuyển dụng không còn mở ứng tuyển.",
      });
    }

    if (result.error === "cv_not_found") {
      return res.status(400).json({
        success: false,
        message: cvId
          ? "Không tìm thấy CV của bạn."
          : "Bạn cần tải lên CV trước khi ứng tuyển.",
      });
    }

    if (result.created) {
      await notifyJobApplicationCountIfNeeded({ jobId });
    }

    return res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created
        ? "Ứng tuyển việc làm thành công."
        : "Bạn đã ứng tuyển việc làm này trước đó.",
      data: {
        application: result.application,
      },
    });
  } catch (error) {
    console.log("APPLY MY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const getMyApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm đã ứng tuyển.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const applications = await findApplicationsByCandidateId(candidate.id);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm đã ứng tuyển thành công.",
      data: {
        candidateId: candidate.id,
        total: applications.length,
        applications,
      },
    });
  } catch (error) {
    console.log("GET MY APPLICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

module.exports = {
  applyMyJob,
  getCandidateDetail,
  getMyApplications,
  getMyCandidate,
  getMyRecommendedJobsFullPosNeg,
  getMyRecommendedJobs,
  getMySavedJobs,
  saveMyJob,
  unsaveMyJob,
  updateMyCandidate,
};
