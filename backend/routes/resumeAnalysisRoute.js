
import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import Resume from "../models/Resume.js";
import {
  estimatePromptTokens,
  queueOpenAIRequest,
} from "../utils/openaiRateLimiter.js";

dotenv.config();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper to safely parse JSON returned by the model
function safeParseJson(maybeJson) {
  if (!maybeJson || typeof maybeJson !== "string") return null;

  // Remove common markdown fences
  let cleaned = maybeJson.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Some models include backticks or extra text — try to find the first {...}
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // fallback: try to evaluate in safe manner (not recommended for untrusted content)
    return null;
  }
}

// Combine and dedupe skills
function combineSkills(resume) {
  const arr = [
    ...(Array.isArray(resume.skills) ? resume.skills : []),
    ...(Array.isArray(resume.technicalSkills) ? resume.technicalSkills : []),
    ...(Array.isArray(resume.softSkills) ? resume.softSkills : []),
  ]
    .filter((s) => typeof s === "string" && s.trim() !== "")
    .map((s) => s.trim());

  // dedupe (case-insensitive)
  const seen = new Set();
  return arr.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}



// --------------------------------------------------
//  GET /api/analysis/:email
//  Perform AI-based resume analysis
// --------------------------------------------------
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const resume = await Resume.findOne({ email });

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // If analysis already exists and is recent, you may decide to return it immediately.
    // But we will still re-run analysis when requested (optionally you can short-circuit).
    // Build the user data to send to AI (include tech/soft skills)
    const userData = {
      personal: {
        ...resume.personal,
        objective:
          resume.personal?.objective ||
          resume.optimizedData?.objective ||
          "",
      },
      skills: combineSkills(resume),
      technicalSkills: resume.technicalSkills || [],
      softSkills: resume.softSkills || [],
      areasOfInterest: resume.areasOfInterest || [],
      achievements: resume.achievements || [],
      cellsAndClubs: resume.cellsAndClubs || [],
      extracurricularActivities: resume.extracurricularActivities || [],
      projects: resume.projects || [],
      education: resume.education || [],
      experience: resume.experience || [],
      internships: resume.internships || [],
      certifications: resume.certifications || [],
      languages: resume.languages || [],
    };

    const jobDescription = resume.jobDescription || "";

    const prompt = `
You are an expert ATS (Applicant Tracking System) evaluator and career coach.

Analyze the resume data and job description below. Return ONLY valid JSON in this exact format:

{
  "atsScore": 0-100,
  "skillGaps": ["missing skill 1", "missing skill 2", ...],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", ...],
  "interviewQuestions": ["question1", "question2", ...]  // up to 20 items
}

RESUME DATA:
${JSON.stringify(userData, null, 2)}

JOB DESCRIPTION:
${jobDescription}
`;

    const tokenEstimate = estimatePromptTokens(prompt, 900);

    // Call the AI (through your rate-limiter wrapper)
    const aiResponse = await queueOpenAIRequest(
      () =>
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.6,
          max_tokens: 900,
        }),
      tokenEstimate
    );

    const raw = aiResponse.choices?.[0]?.message?.content || "";

    // Parse AI output to JSON safely
    const parsed = safeParseJson(raw);
    if (!parsed) {
      console.error("AI returned invalid JSON:", raw);
      return res.status(500).json({
        message: "AI returned invalid JSON",
        raw,
      });
    }

    // Normalize parsed fields (support multiple possible keys)
    const atsScore = (() => {
      const v = parsed.atsScore ?? parsed.score ?? null;
      const num = Number(v);
      if (Number.isFinite(num)) return Math.max(0, Math.min(100, Math.round(num)));
      return null;
    })();

   


    const skillGaps =
      parsed.skillGaps ||
      parsed.missingSkills ||
      parsed.missing_skills ||
      [];

    const suggestions =
      Array.isArray(parsed.suggestions)
        ? parsed.suggestions
        : Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : typeof parsed.suggestions === "string"
        ? [parsed.suggestions]
        : [];

    const interviewQuestions =
      Array.isArray(parsed.interviewQuestions)
        ? parsed.interviewQuestions.slice(0, 20)
        : Array.isArray(parsed.questions)
        ? parsed.questions.slice(0, 20)
        : [];

    // Save into resume.analysis in the exact schema shape
    resume.analysis = {
      atsScore: atsScore === null ? null : atsScore,
      skillGaps: Array.isArray(skillGaps) ? skillGaps : [],
      recommendations: Array.isArray(suggestions)
        ? suggestions.join(" ")
        : typeof suggestions === "string"
        ? suggestions
        : "",
      interviewQuestions,
      updatedAt: new Date(),
    };

    await resume.save();

    // Return the saved analysis object
    return res.json(resume.analysis);
  } catch (error) {
    console.error("❌ Resume analysis error:", error);
    
    // Check if it's a rate limit error
    const isRateLimitError = 
      error?.code === 'rate_limit_exceeded' || 
      error?.status === 429 ||
      error?.message?.toLowerCase().includes('rate limit');
    
    // If rate limit error and we have existing analysis, return it instead of failing
    if (isRateLimitError && resume.analysis && resume.analysis.atsScore !== null) {
      console.log("⚠️ Rate limit reached, returning existing analysis");
      return res.status(200).json({
        ...resume.analysis,
        warning: "Using cached analysis due to rate limit. Please try again later for updated analysis.",
      });
    }
    
    // If we have existing analysis (even if rate limited), return it with a warning
    if (resume.analysis && (resume.analysis.atsScore !== null || resume.analysis.skillGaps?.length > 0)) {
      return res.status(200).json({
        ...resume.analysis,
        warning: "Unable to generate new analysis. Showing previous results.",
      });
    }
    
    // If no existing analysis, return error
    return res.status(isRateLimitError ? 429 : 500).json({
      message: isRateLimitError 
        ? "Rate limit reached. Please try again later or check your OpenAI API limits."
        : "Error analyzing resume",
      error: error?.message || String(error),
    });
  }
});

export default router;
