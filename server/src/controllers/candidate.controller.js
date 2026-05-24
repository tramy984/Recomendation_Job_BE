const {
  findCandidateById,
  findCandidateByUserId,
  updateCandidateByUserId,
} = require("../models/candidate.model");
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

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const getMyCandidate = async (req, res) => {
  try {
    const userId = req.user.id;

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
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
      avatar = `/uploads/candidates/${req.file.filename}`;
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
  getMySavedJobs,
  saveMyJob,
  unsaveMyJob,
  updateMyCandidate,
};
