import express from "express";
import ResumeDownload from "../models/ResumeDownload.js";

const router = express.Router();

// ✅ Track PDF download
router.post("/", async (req, res) => {
  try {
    const { userId, templateId, templateName } = req.body;

    if (!userId || !templateId || !templateName) {
      return res.status(400).json({
        message: "userId, templateId, and templateName are required.",
      });
    }

    const downloadRecord = new ResumeDownload({
      userId,
      templateId,
      templateName,
      downloadedAt: new Date(),
    });

    await downloadRecord.save();

    res.status(200).json({
      message: "Download tracked successfully",
      download: downloadRecord,
    });
  } catch (error) {
    console.error("❌ Error tracking download:", error);
    res.status(500).json({
      message: "Error tracking download",
      error: error.message,
    });
  }
});

// ✅ Get download history for a user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const downloads = await ResumeDownload.find({ userId })
      .sort({ downloadedAt: -1 })
      .limit(50);

    res.status(200).json({ downloads });
  } catch (error) {
    console.error("❌ Error fetching downloads:", error);
    res.status(500).json({
      message: "Error fetching downloads",
      error: error.message,
    });
  }
});

export default router;

