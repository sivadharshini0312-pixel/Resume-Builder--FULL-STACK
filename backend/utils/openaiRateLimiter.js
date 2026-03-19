const WINDOW_MS = 60 * 1000;
const REQUEST_LIMIT = 3; // per minute
const TOKEN_LIMIT = 60000; // per minute

const queue = [];
const requestTimestamps = [];
const tokenTimestamps = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanup = (now) => {
  while (requestTimestamps.length && now - requestTimestamps[0] >= WINDOW_MS) {
    requestTimestamps.shift();
  }

  while (tokenTimestamps.length && now - tokenTimestamps[0].timestamp >= WINDOW_MS) {
    tokenTimestamps.shift();
  }
};

const getTokensUsed = () =>
  tokenTimestamps.reduce((sum, entry) => sum + entry.tokens, 0);

let processing = false;

const processQueue = async () => {
  if (processing) return;
  processing = true;

  try {
    while (queue.length) {
      const task = queue[0];
      const now = Date.now();
      cleanup(now);

      const tokensUsed = getTokensUsed();
      const wouldExceedTokens = tokensUsed + task.tokens > TOKEN_LIMIT;
      const wouldExceedRequests = requestTimestamps.length >= REQUEST_LIMIT;

      if (wouldExceedTokens || wouldExceedRequests) {
        const waitForRequests =
          requestTimestamps.length === 0
            ? WINDOW_MS
            : WINDOW_MS - (now - requestTimestamps[0]);

        const waitForTokens =
          tokenTimestamps.length === 0
            ? WINDOW_MS
            : WINDOW_MS - (now - tokenTimestamps[0].timestamp);

        const waitTime = Math.max(
          50,
          wouldExceedRequests ? waitForRequests : 0,
          wouldExceedTokens ? waitForTokens : 0
        );

        await sleep(waitTime);
        continue;
      }

      queue.shift();

      requestTimestamps.push(now);
      tokenTimestamps.push({ timestamp: now, tokens: task.tokens });

      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }
  } finally {
    processing = false;
    if (queue.length) {
      setTimeout(processQueue, 0);
    }
  }
};

export const queueOpenAIRequest = (fn, tokensEstimate = 0) =>
  new Promise((resolve, reject) => {
    const tokens = Number.isFinite(tokensEstimate) && tokensEstimate > 0 ? tokensEstimate : 0;
    queue.push({ fn, tokens, resolve, reject });
    processQueue();
  });

export const estimatePromptTokens = (prompt = "", expectedCompletionTokens = 0) => {
  const promptTokens = Math.ceil(String(prompt).length / 4);
  const completionTokens = Number.isFinite(expectedCompletionTokens)
    ? expectedCompletionTokens
    : 0;
  return promptTokens + completionTokens;
};

