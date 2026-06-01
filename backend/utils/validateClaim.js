/**
 * utils/validateClaim.js
 * All backend validation rules for claims and sources.
 * Called by claimRoutes and sourceRoutes.
 */

/* ============================================================
   RULE 1 — CLAIM TEXT VALIDATION
   ============================================================ */

// Allowed characters: A-Z a-z 0-9 space . , %
const CLAIM_ALLOWED_CHARS = /^[A-Za-z0-9 .,%-]+$/;

// Must have at least 2 separate words (not just one word or only numbers)
const ONLY_NUMBERS = /^\d+$/;

/**
 * Extract words (sequences of letters) from text
 */
function extractWords(text) {
  return text.match(/[A-Za-z]+/g) || [];
}

/**
 * Validate claim text against all rules.
 * Returns { valid: true } or { valid: false, error: "message" }
 */
function validateClaimText(text) {
  if (!text || !text.trim()) {
    return { valid: false, error: "Claim is required" };
  }

  const trimmed = text.trim();

  if (trimmed.length < 10) {
    return { valid: false, error: "Claim must be at least 10 characters long" };
  }

  if (trimmed.length > 300) {
    return { valid: false, error: "Claim must not exceed 300 characters" };
  }

  // Check for disallowed characters
  if (!CLAIM_ALLOWED_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: "Claim may only contain letters, numbers, spaces, and the punctuation . , %"
    };
  }

  // Must not be only digits
  if (ONLY_NUMBERS.test(trimmed.replace(/\s/g, ""))) {
    return { valid: false, error: "Claim must not contain only numbers" };
  }

  // Must have at least 2 letter-words (rejects single-word nonsense like 'test', 'abc', 'no')
  const words = extractWords(trimmed);
  if (words.length < 2) {
    return {
      valid: false,
      error: "Claim must represent a clear factual statement with at least two words"
    };
  }

  return { valid: true };
}

/* ============================================================
   RULE 2 — SOURCE TYPE VALIDATION
   ============================================================ */

const VALID_SOURCE_TYPES = ["official", "media", "document", "user"];

function validateSourceType(sourceType) {
  if (!sourceType || !sourceType.trim()) {
    return { valid: false, error: "Please select a source type" };
  }
  if (!VALID_SOURCE_TYPES.includes(sourceType)) {
    return { valid: false, error: "Invalid source type selected" };
  }
  return { valid: true };
}

/* ============================================================
   RULE 3 — OFFICIAL SOURCE DOMAIN VALIDATION
   ============================================================ */

// Domains that are ALLOWED for official sources
const OFFICIAL_ALLOWED_DOMAINS = [
  ".gov.in", ".nic.in", ".gov", ".int",
  "who.int", "un.org", "unicef.org", "worldbank.org",
  "imf.org", "wto.org", "ilo.org", "unesco.org",
  "rbi.org.in", "sebi.gov.in", "pib.gov.in",
  "mygov.in", "india.gov.in", "mohfw.gov.in",
  "meity.gov.in", "mhrd.gov.in"
];

// Domains that are EXPLICITLY BLOCKED even for official type
const BLOCKED_DOMAINS = [
  "youtube.com", "youtu.be",
  "twitter.com", "x.com",
  "instagram.com", "facebook.com",
  "tiktok.com", "reddit.com",
  "linkedin.com", "pinterest.com",
  "medium.com", "blogspot.com",
  "wordpress.com", "tumblr.com",
  "quora.com", "wikipedia.org"
];

/**
 * Extracts hostname from a URL string safely.
 */
function getHostname(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validate URL format — must start with http:// or https://
 */
function validateURLFormat(url) {
  if (!url) return { valid: true }; // URL is optional if file provided
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { valid: false, error: "URL must start with http:// or https://" };
  }
  const hostname = getHostname(url);
  if (!hostname) {
    return { valid: false, error: "Invalid URL format" };
  }
  return { valid: true, hostname };
}

/**
 * Check if hostname matches official allowed domains
 */
function isOfficialDomain(hostname) {
  return OFFICIAL_ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d) || hostname.endsWith(d));
}

/**
 * Check if hostname is a blocked social/blog domain
 */
function isBlockedDomain(hostname) {
  return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
}

/**
 * Full URL validation for a given source type.
 */
function validateSourceURL(url, sourceType) {
  if (!url) return { valid: true }; // no URL provided — file must be provided (checked separately)

  const formatCheck = validateURLFormat(url);
  if (!formatCheck.valid) return formatCheck;

  const hostname = formatCheck.hostname;

  // Block social/blog domains for ALL source types
  if (isBlockedDomain(hostname)) {
    return {
      valid: false,
      error: `The domain "${hostname}" is not accepted as a reliable source`
    };
  }

  // For official sources, enforce allowed domains
  if (sourceType === "official") {
    if (!isOfficialDomain(hostname)) {
      return {
        valid: false,
        error: "Please provide a valid official government or organisation website link (e.g. .gov.in, .nic.in, .int)"
      };
    }
  }

  return { valid: true };
}

/* ============================================================
   RULE 5 + 6 — PDF VALIDATION (file type, size, content)
   ============================================================ */

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const PDF_MIME = "application/pdf";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MIN_PDF_TEXT_LENGTH = 100;        // characters
const KEYWORD_MATCH_THRESHOLD = 0.40;  // 40% of claim keywords must appear in PDF

/**
 * Validate uploaded file (type + size).
 */
function validateFile(file) {
  if (!file) return { valid: true }; // no file — URL must be provided (checked separately)

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: "Only PDF, JPG, and PNG files are allowed" };
  }

  if (file.size === 0) {
    return { valid: false, error: "Uploaded file is empty" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File must be under 5 MB" };
  }

  return { valid: true };
}

/**
 * Extract keywords from claim text (unique letter-words, length > 3, lowercased).
 * Short stop-words are excluded automatically by the length filter.
 */
function extractKeywords(claimText) {
  const stopWords = new Set([
    "the","and","for","that","this","with","from","have","are","was",
    "were","been","has","not","but","they","their","will","would","could",
    "should","about","into","than","then","when","which","what","who"
  ]);
  const words = (claimText.match(/[A-Za-z]{4,}/g) || []).map(w => w.toLowerCase());
  return [...new Set(words.filter(w => !stopWords.has(w)))];
}

/**
 * Calculate what % of claim keywords appear in the PDF text.
 */
function calcKeywordMatchRatio(keywords, pdfText) {
  if (!keywords.length) return 1; // no keywords to check — pass
  const lower = pdfText.toLowerCase();
  const matched = keywords.filter(k => lower.includes(k));
  return matched.length / keywords.length;
}

/**
 * Validate PDF content against the claim.
 * Requires pdf-parse. Returns { valid, warning, relevanceScore, matchedKeywords, error }
 * This is async because pdf-parse is async.
 */
async function validatePDFContent(filePath, claimText) {
  let pdfParse;
  try {
    pdfParse = require("pdf-parse");
  } catch {
    // pdf-parse not installed — skip content check, allow upload
    return { valid: true, warning: "PDF content check unavailable" };
  }

  const fs = require("fs");

  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();

    if (text.length < MIN_PDF_TEXT_LENGTH) {
      return {
        valid: false,
        error: "Uploaded document contains no readable text or is blank"
      };
    }

    const keywords = extractKeywords(claimText);
    const ratio = calcKeywordMatchRatio(keywords, text);
    const relevanceScore = Math.round(ratio * 100);
    const matched = keywords.filter(k => text.toLowerCase().includes(k));

    if (ratio < KEYWORD_MATCH_THRESHOLD) {
      return {
        valid: false,
        relevanceScore,
        matchedKeywords: matched,
        error: "Uploaded document does not appear relevant to the claim"
      };
    }

    return {
      valid: true,
      relevanceScore,
      matchedKeywords: matched,
      extractedText: text.slice(0, 8000)
    };

  } catch (err) {
    // If PDF parsing itself fails (corrupted file)
    return {
      valid: false,
      error: "Could not read the uploaded PDF. The file may be corrupted."
    };
  }
}

/* ============================================================
   RULE 4 — DUPLICATE URL CHECK (within a single submission)
   ============================================================ */

/**
 * Given an array of URL strings from the current submission,
 * return true if any duplicate exists.
 */
function hasDuplicateURLs(urls) {
  const clean = urls.filter(Boolean).map(u => u.trim().toLowerCase());
  return new Set(clean).size !== clean.length;
}

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  validateClaimText,
  validateSourceType,
  validateSourceURL,
  validateURLFormat,
  validateFile,
  validatePDFContent,
  hasDuplicateURLs,
  extractKeywords,
  calcKeywordMatchRatio,
  isOfficialDomain,
  isBlockedDomain,
  MAX_FILE_SIZE,
  KEYWORD_MATCH_THRESHOLD
};
