const {
  createNotification,
  getJobApplicationNotificationTarget,
  getUserEmailById,
  upsertJobApplicationCountNotification,
} = require("../models/notification.model");
const { sendMail } = require("./mail.service");

const sendNotificationMail = async ({ email, title, content }) => {
  try {
    return await sendMail({
      to: email,
      subject: title,
      text: content,
      html: `<p>${content}</p>`,
    });
  } catch (error) {
    console.error("Lỗi gửi email thông báo:", error);
    return false;
  }
};

const notifyUser = async ({
  senderId = null,
  receiverId,
  receiverEmail = null,
  title,
  content,
  type = "general",
  referenceType = null,
  referenceId = null,
}) => {
  if (!receiverId || !title || !content) return null;

  try {
    const notification = await createNotification({
      senderId,
      receiverId,
      title,
      content,
      type,
      referenceType,
      referenceId,
    });

    const email = receiverEmail || (await getUserEmailById(receiverId));
    const emailSent = await sendNotificationMail({ email, title, content });

    return {
      notification,
      emailSent,
    };
  } catch (error) {
    console.error("Lỗi tạo thông báo:", error);
    return null;
  }
};

const notifyApplicationReviewed = async ({
  senderId,
  application,
  isApproved,
  reasonReject = null,
}) => {
  const receiverId = application?.candidate?.user_id;
  const receiverEmail = application?.candidate?.email;
  const jobName = application?.job?.name || "công việc bạn đã ứng tuyển";
  const title = isApproved ? "CV đã được duyệt" : "CV đã bị từ chối";
  const content = isApproved
    ? `Nhà tuyển dụng đã duyệt CV của bạn cho công việc "${jobName}".`
    : `Nhà tuyển dụng đã từ chối CV của bạn cho công việc "${jobName}".${
        reasonReject ? ` Lý do: ${reasonReject}.` : ""
      }`;

  return notifyUser({
    senderId,
    receiverId,
    receiverEmail,
    title,
    content,
    type: isApproved ? "application_approved" : "application_rejected",
    referenceType: "application",
    referenceId: application?.id,
  });
};

const notifyPendingCompanyReviewed = async ({
  senderId,
  pendingCompany,
  isApproved,
}) => {
  const receiverId = pendingCompany?.recruiter?.user_id;
  const receiverEmail = pendingCompany?.recruiter?.email;
  const companyName = pendingCompany?.name || "hồ sơ công ty";
  const title = isApproved
    ? "Hồ sơ công ty đã được duyệt"
    : "Hồ sơ công ty đã bị từ chối";
  const content = isApproved
    ? `Admin đã duyệt hồ sơ công ty "${companyName}" của bạn.`
    : `Admin đã từ chối hồ sơ công ty "${companyName}" của bạn.${
        pendingCompany?.reject_reason
          ? ` Lý do: ${pendingCompany.reject_reason}.`
          : ""
      }`;

  return notifyUser({
    senderId,
    receiverId,
    receiverEmail,
    title,
    content,
    type: isApproved ? "company_approved" : "company_rejected",
    referenceType: "pending_company",
    referenceId: pendingCompany?.id,
  });
};

const notifyJobApplicationCountIfNeeded = async ({ jobId }) => {
  try {
    const target = await getJobApplicationNotificationTarget(jobId);

    if (!target?.receiver_id) return null;

    const applicantCount = Number(target.applied_number || 0);

    if (applicantCount === 0 || applicantCount % 10 !== 0) {
      return null;
    }

    const jobName = target.job_name || "công việc của bạn";
    const title = "Cập nhật số lượng ứng viên";
    const content = `Đã có ${applicantCount} ứng viên ứng tuyển công việc "${jobName}" của bạn.`;

    const notification = await upsertJobApplicationCountNotification({
      receiverId: target.receiver_id,
      jobId: target.job_id,
      jobName,
      applicantCount,
      title,
      content,
    });

    const emailSent = await sendNotificationMail({
      email: target.receiver_email,
      title,
      content,
    });

    return {
      notification,
      emailSent,
    };
  } catch (error) {
    console.error("Lỗi thông báo số lượng ứng viên:", error);
    return null;
  }
};

module.exports = {
  notifyApplicationReviewed,
  notifyJobApplicationCountIfNeeded,
  notifyPendingCompanyReviewed,
  notifyUser,
};
