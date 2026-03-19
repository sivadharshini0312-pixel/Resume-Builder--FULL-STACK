import OpenAI from "openai";
import Bottleneck from "bottleneck";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Bottleneck: allow 1 request every 25 seconds (safe for 3 RPM limit)
const limiter = new Bottleneck({
  minTime: 25000, // 25s between requests
  maxConcurrent: 1, // one request at a time
});

// Retry logic for 429 errors (rate limit)
async function withRetry(fn, retries = 5) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429) {
        const wait = 20000 + attempt * 5000; // wait longer each retry
        console.warn(`⚠️ Rate limit hit. Retrying in ${wait / 1000}s...`);
        await new Promise((res) => setTimeout(res, wait));
        attempt++;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Exceeded retry limit for OpenAI request");
}

// Wrapper for all OpenAI calls
export async function safeOpenAICall(params) {
  return limiter.schedule(() => withRetry(() => openai.chat.completions.create(params)));
}

export default openai;
