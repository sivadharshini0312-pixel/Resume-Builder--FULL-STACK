import express from "express";
import User from "../models/User.js";
import ResumeDownload from "../models/ResumeDownload.js";

const router = express.Router();

// ✅ Get admin statistics
router.get("/stats", async (req, res) => {
  try {
    // Get total number of users
    const totalUsers = await User.countDocuments();

    // Get total number of downloads
    const totalDownloads = await ResumeDownload.countDocuments();

    // Get template usage breakdown
    const templateStats = await ResumeDownload.aggregate([
      {
        $group: {
          _id: "$templateName",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $project: {
          name: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Find most used template
    const mostUsedTemplate =
      templateStats.length > 0
        ? {
            name: templateStats[0].name,
            count: templateStats[0].count,
          }
        : { name: "N/A", count: 0 };

    res.status(200).json({
      totalUsers,
      totalDownloads,
      mostUsedTemplate,
      templateBreakdown: templateStats,
    });
  } catch (error) {
    console.error("❌ Error fetching admin stats:", error);
    res.status(500).json({
      message: "Error fetching admin statistics",
      error: error.message,
    });
  }
});

export default router;

