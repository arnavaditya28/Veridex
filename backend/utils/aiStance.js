/**
 * utils/aiStance.js
 * AI-assisted evidence checking for Veridex (Google Gemini, free tier).
 *
 * For each source that has extracted text, this asks the Gemini API whether
 * the source SUPPORTS, CONTRADICTS, or is UNRELATED to the claim, with a short
 * reason. The results are fed into the reliability scorer.
 *
 * Free key: https://aistudio.google.com (no credit card required).
 *
 * Fails safe: if GEMINI_API_KEY is not set, global fetch is unavailable, or any
 * request errors out, the affected source is returned as "unanalyzed" and the
 * rule-based score is used unchanged. The app works fine without a key.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_TEXT_CHARS = 6000; // keep token usage bounded per source

async function analyzeOneSource(claimText, source, apiKey, model) {
  const text = (source.extractedText || "").trim();

  // URL-only sources and images have no readable text to judge
  if (!text) {
    return {
      sourceId: source._id,
      sourceType: source.sourceType,
      stance: "unanalyzed",
      reason: "No readable content to analyze"
    };
  }

  const snippet = text.slice(0, MAX_TEXT_CHARS);

  const systemPrompt =
    "You are a careful fact-checking assistant. You are given a CLAIM and the " +
    "text of a SOURCE document. Decide whether the source SUPPORTS the claim, " +
    "CONTRADICTS the claim, or is UNRELATED to it. Base your judgment only on the " +
    "source text provided. Respond with ONLY a JSON object in this exact form: " +
    '{"stance":"supports|contradicts|unrelated","reason":"one short sentence"}.';

  try {
    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: "user", parts: [{ text: `CLAIM:\n${claimText}\n\nSOURCE TEXT:\n${snippet}` }] }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      return {
        sourceId: source._id,
        sourceType: source.sourceType,
        stance: "unanalyzed",
        reason: `AI check unavailable (HTTP ${response.status})`
      };
    }

    const data = await response.json();
    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        sourceId: source._id,
        sourceType: source.sourceType,
        stance: "unanalyzed",
        reason: "AI returned an unreadable response"
      };
    }

    const validStances = ["supports", "contradicts", "unrelated"];
    const stance = validStances.includes(parsed.stance) ? parsed.stance : "unanalyzed";

    return {
      sourceId: source._id,
      sourceType: source.sourceType,
      stance,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : ""
    };
  } catch (err) {
    return {
      sourceId: source._id,
      sourceType: source.sourceType,
      stance: "unanalyzed",
      reason: "AI check error"
    };
  }
}

/**
 * Analyze every source for a claim.
 * Returns { enabled: boolean, results: [...] }.
 */
async function analyzeSourcesStance(claimText, sources) {
  const apiKey = process.env.GEMINI_API_KEY;

  // No key or no fetch → feature disabled, fall back to rule-based scoring
  if (!apiKey || typeof fetch !== "function") {
    return { enabled: false, results: [] };
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  // Sequential calls — claims allow at most 5 sources, well within free limits
  const results = [];
  for (const source of sources) {
    results.push(await analyzeOneSource(claimText, source, apiKey, model));
  }

  return { enabled: true, results };
}

module.exports = { analyzeSourcesStance };
