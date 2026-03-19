import mongoose from "mongoose";

const resumeDownloadSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // user email
    templateId: { type: String, required: true }, // template name/identifier
    templateName: { type: String, required: true },
    downloadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

const ResumeDownload =
  mongoose.models.ResumeDownload ||
  mongoose.model("ResumeDownload", resumeDownloadSchema);

export default ResumeDownload;

