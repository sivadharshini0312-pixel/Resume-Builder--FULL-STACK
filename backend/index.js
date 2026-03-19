/*
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Resume from "./models/Resume.js";
import User from "./models/User.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import optimizeRoutes from "./routes/optimizeRoute.js";
import resumeAnalysisRoutes from "./routes/resumeAnalysisRoute.js";
import downloadRoutes from "./routes/downloadRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import {
  estimatePromptTokens,
  queueOpenAIRequest,
} from "./utils/openaiRateLimiter.js";

dotenv.config();

const app = express();

// ✅ Enable CORS
app.use(cors());

// ✅ Fix: Increase payload size limit to prevent PayloadTooLargeError
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ✅ All resume routes will start with /api/resumes
app.use("/api/resume", resumeRoutes);
app.use("/api/optimize", optimizeRoutes);
app.use("/api/analysis", resumeAnalysisRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/admin", adminRoutes);

// ✅ Environment checks
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env file");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env file");
  process.exit(1);
}
console.log("✅ Environment loaded successfully");

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ User model is imported from ./models/User.js

// ✅ OpenAI Setup
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Default route
app.get("/", (req, res) => {
  res.send("🚀 Resume Generator Backend is running...");
});

// ✅ SIGNUP
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "✅ Signup successful" });
  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      message: "✅ Login successful",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ Resume saving endpoint
app.post("/api/resumes/generate", async (req, res) => {
  try {
    const {
      email,
      personal = {},
      jobDescription = "",
      skills = [],
      projects = [],
      education = [],
      experience = [],
      certifications = [],
      internships = [],
      languages = [],
    } = req.body;

    if (!email || !personal?.fullName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const trimText = (value = "", maxChars = 800) =>
      String(value).replace(/\s+/g, " ").trim().slice(0, maxChars);

    const ensureArray = (value) => (Array.isArray(value) ? value : []);
    const limitArray = (value = [], maxItems = 5) =>
      ensureArray(value).filter((item) => item !== undefined && item !== null).slice(0, maxItems);

    const safePersonal = {
      fullName: trimText(personal.fullName, 120),
      email: trimText(personal.email || "", 200),
      phone: trimText(personal.phone || "", 60),
      objective: trimText(personal.objective || "", 600),
      linkedIn: trimText(personal.linkedIn || "", 200),
      github: trimText(personal.github || "", 200),
    };

    const safePayload = {
      personal: safePersonal,
      jobDescription: trimText(jobDescription, 1200),
      skills: limitArray(skills, 12).map((skill) => trimText(skill, 80)),
      projects: limitArray(
        ensureArray(projects).map((p) => ({
          title: trimText(p?.title || "", 120),
          description: trimText(p?.description || "", 320),
        })),
        4
      ),
      experience: limitArray(
        ensureArray(experience).map((exp) => ({
          role: trimText(exp?.role || "", 120),
          company: trimText(exp?.company || "", 120),
          duration: trimText(exp?.duration || "", 100),
          details: trimText(exp?.details || "", 320),
        })),
        4
      ),
      education: limitArray(
        ensureArray(education).map((edu) => ({
          degree: trimText(edu?.degree || "", 120),
          institution: trimText(edu?.institution || "", 160),
          year: trimText(edu?.year || "", 40),
        })),
        4
      ),
      certifications: limitArray(certifications, 6).map((cert) => trimText(cert, 120)),
      internships: limitArray(
        ensureArray(internships).map((intern) => ({
          company: trimText(intern?.company || "", 120),
          role: trimText(intern?.role || "", 120),
          duration: trimText(intern?.duration || "", 100),
          details: trimText(intern?.details || "", 300),
        })),
        3
      ),
      languages: limitArray(languages, 6).map((lang) => trimText(lang, 60)),
    };

    const prompt = `
You are a resume writing assistant. Improve the following resume to better fit the job description. Keep responses concise and in JSON with the same structure you receive.

Resume:
${JSON.stringify(safePayload, null, 2)}
`;

    const tokenEstimate = estimatePromptTokens(prompt, 900);

    const aiResponse = await queueOpenAIRequest(
      () =>
        client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.6,
          max_tokens: 450,
        }),
      tokenEstimate
    );

    const optimizedText = aiResponse.choices?.[0]?.message?.content?.trim();

    const newResume = new Resume({
      email,
      personal,
      jobDescription,
      skills,
      projects,
      education,
      experience,
      certifications,
      internships,
      languages,
      optimizedData: optimizedText || "",
    });

    await newResume.save();

    res.status(200).json({
      message: "✅ Resume data saved successfully!",
      optimizedData: optimizedText,
    });
  } catch (error) {
    console.error("❌ Error saving resume:", error);
    res.status(500).json({
      message: "Failed to generate or save resume.",
      error: error.message,
    });
  }
});

// ✅ Global Error Handler (optional but recommended)
app.use((err, req, res, next) => {
  console.error("⚠️ Global Error:", err.stack);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload too large" });
  }
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
*/

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Resume from "./models/Resume.js";
import User from "./models/User.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import optimizeRoutes from "./routes/optimizeRoute.js";
import resumeAnalysisRoutes from "./routes/resumeAnalysisRoute.js";
import downloadRoutes from "./routes/downloadRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import {
  estimatePromptTokens,
  queueOpenAIRequest,
} from "./utils/openaiRateLimiter.js";

dotenv.config();

const app = express();

// CORS
app.use(cors());

// Increase payload limit
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Routes
app.use("/api/resume", resumeRoutes);
app.use("/api/optimize", optimizeRoutes);
app.use("/api/analysis", resumeAnalysisRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/admin", adminRoutes);

// Env checks
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}
console.log("✅ Environment loaded successfully");

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MONGO ERROR:", err));

// OPENAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Root route
app.get("/", (req, res) => {
  res.send("🚀 Resume Builder Backend Running...");
});

/* -------------------------- SIGNUP -------------------------- */
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashed });
    await newUser.save();

    res.status(201).json({ message: "Signup successful" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------- LOGIN --------------------------- */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      message: "Login successful",
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------- RESUME SAVE + AI OPTIMIZE -------------------- */

app.post("/api/resumes/generate", async (req, res) => {
  try {
    const {
      email,
      personal = {},
      jobDescription = "",

      skills = [],
      technicalSkills = [],
      softSkills = [],

      areasOfInterest = [],
      achievements = [],
      cellsAndClubs = [],
      extracurricularActivities = [],

      projects = [],
      education = [],
      experience = [],
      internships = [],
      certifications = [],
      languages = [],
    } = req.body;

    if (!email || !personal.fullName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // AI Input Sanitization
    const trim = (str, max = 600) =>
      String(str || "").replace(/\s+/g, " ").trim().slice(0, max);

    // Get existing resume to preserve optimized objective and analysis if available
    const existingResume = await Resume.findOne({ email });

    // Use optimized objective from existing resume if available, otherwise use submitted objective
    const optimizedObjective = 
      personal.objective || 
      existingResume?.optimizedData?.objective || 
      "";

    // SAVE FULL RESUME - No AI call here, just save the data
    // Prepare update object
    const updateData = {
      personal,
      jobDescription,
      skills,
      technicalSkills,
      softSkills,
      areasOfInterest,
      achievements,
      cellsAndClubs,
      extracurricularActivities,
      projects,
      education,
      experience,
      internships,
      certifications,
      languages,
      optimizedData: {
        objective: optimizedObjective,
        skills,
        updatedAt: new Date(),
      },
    };

    // Preserve existing analysis if it exists, otherwise set empty analysis
    if (existingResume?.analysis) {
      // Keep existing analysis - don't overwrite it
      updateData.analysis = existingResume.analysis;
    } else {
      // Initialize empty analysis for new resumes
      updateData.analysis = {
        atsScore: null,
        skillGaps: [],
        recommendations: "",
        interviewQuestions: [],
        updatedAt: null,
      };
    }

    // Use findOneAndUpdate to update existing resume or create new one
    const savedResume = await Resume.findOneAndUpdate(
      { email },
      { $set: updateData, $setOnInsert: { email } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      message: "Resume saved successfully",
      resume: savedResume,
    });
  } catch (error) {
    console.error("ERROR saving resume:", error);
    res.status(500).json({
      message: "Failed to save resume",
      error: error.message,
    });
  }
});

/* -------------------- GLOBAL ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.stack);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload too large" });
  }
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
