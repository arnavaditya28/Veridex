function evaluateClaim(sources, claimCreatedAt) {

  let totalScore = 0;
  let ruleBreakdown = [];

  /* =========================
     RULE 1: SOURCE TYPE WEIGHT
  ========================= */
  const typeWeights = { official: 40, document: 30, media: 25, user: 10 };
  const uniqueTypes = new Set();

  sources.forEach(src => {
    if (typeWeights[src.sourceType]) {
      totalScore += typeWeights[src.sourceType];
      ruleBreakdown.push(`+${typeWeights[src.sourceType]} from ${src.sourceType} source`);
      uniqueTypes.add(src.sourceType);
    }

    // Moderator adjustments
    if (src.reviewStatus === "relevant")   { totalScore += 10;  ruleBreakdown.push("+10 moderator verified relevant"); }
    if (src.reviewStatus === "irrelevant") { totalScore -= 15;  ruleBreakdown.push("-15 moderator marked irrelevant"); }
    if (src.reviewStatus === "outdated")   { totalScore -= 10;  ruleBreakdown.push("-10 moderator marked outdated"); }
  });

  /* =========================
     RULE 2: SOURCE DIVERSITY
  ========================= */
  if (uniqueTypes.size >= 2) { totalScore += 10; ruleBreakdown.push("+10 diversity bonus (2+ types)"); }
  if (uniqueTypes.size >= 3) { totalScore += 10; ruleBreakdown.push("+10 strong diversity (3+ types)"); }

  /* =========================
     RULE 3: FRESHNESS
  ========================= */
  const ageInDays = (Date.now() - new Date(claimCreatedAt)) / (1000 * 60 * 60 * 24);
  let freshnessScore = 0;
  if (ageInDays <= 7)  { freshnessScore = 10; }
  else if (ageInDays <= 30) { freshnessScore = 5; }
  totalScore += freshnessScore;
  if (freshnessScore > 0) ruleBreakdown.push(`+${freshnessScore} freshness bonus`);

  /* =========================
     NORMALIZE
  ========================= */
  totalScore = Math.max(0, Math.min(100, totalScore));

  /* =========================
     CONFIDENCE LEVEL
  ========================= */
  let confidenceLevel = "low";
  if (totalScore >= 80)      confidenceLevel = "very high";
  else if (totalScore >= 65) confidenceLevel = "high";
  else if (totalScore >= 40) confidenceLevel = "moderate";
  else if (totalScore >= 20) confidenceLevel = "low";
  else                       confidenceLevel = "very low";

  return {
    totalScore,
    confidenceLevel,
    freshnessScore,
    ruleBreakdown,
    uniqueTypesCount: uniqueTypes.size
  };
}

module.exports = evaluateClaim;
