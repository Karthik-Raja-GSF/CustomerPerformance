export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ParsedConfidence {
  score: number;
  level: ConfidenceLevel;
  reasoning: string;
  cleanedText: string;
}

// New percentage-based patterns
const PERCENTAGE_CONFIDENCE_PATTERN =
  /---\s*\n\*\*Confidence:\*\*\s*(\d{1,3})\s*%?\s*\n\*\*Reasoning:\*\*\s*(.+?)\s*\n---\s*$/is;

const FLEXIBLE_PERCENTAGE_PATTERN =
  /\*\*Confidence:\*\*\s*(\d{1,3})\s*%?[^\n]*\n\*\*Reasoning:\*\*\s*(.+?)(?:\n---|\n\n|$)/is;

// Legacy categorical patterns for backward compatibility
const LEGACY_CONFIDENCE_PATTERN =
  /---\s*\n\*\*Confidence:\*\*\s*(HIGH|MEDIUM|LOW)\s*\n\*\*Reasoning:\*\*\s*(.+?)\s*\n---\s*$/i;

const LEGACY_FALLBACK_PATTERN =
  /\*\*Confidence:\*\*\s*(HIGH|MEDIUM|LOW)[^\n]*\n\*\*Reasoning:\*\*\s*(.+?)(?:\n---|\n\n|$)/i;

// Fixed scores for legacy categorical values
const LEGACY_SCORE_MAP: Record<ConfidenceLevel, number> = {
  HIGH: 92,
  MEDIUM: 67,
  LOW: 35,
};

function deriveConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 71) return "HIGH";
  if (score >= 41) return "MEDIUM";
  return "LOW";
}

function normalizePercentage(value: number): number {
  if (isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseVerbalizedConfidence(text: string): ParsedConfidence {
  // Strategy 1: Try new percentage format (strict)
  let match = text.match(PERCENTAGE_CONFIDENCE_PATTERN);
  if (match && match[1] && match[2]) {
    const score = normalizePercentage(parseInt(match[1], 10));
    return {
      score,
      level: deriveConfidenceLevel(score),
      reasoning: match[2].trim(),
      cleanedText: text.replace(PERCENTAGE_CONFIDENCE_PATTERN, "").trim(),
    };
  }

  // Strategy 2: Try flexible percentage format
  match = text.match(FLEXIBLE_PERCENTAGE_PATTERN);
  if (match && match[1] && match[2]) {
    const score = normalizePercentage(parseInt(match[1], 10));
    return {
      score,
      level: deriveConfidenceLevel(score),
      reasoning: match[2].trim(),
      cleanedText: text.replace(FLEXIBLE_PERCENTAGE_PATTERN, "").trim(),
    };
  }

  // Strategy 3: Try legacy categorical format (backward compatibility)
  match = text.match(LEGACY_CONFIDENCE_PATTERN);
  if (match && match[1] && match[2]) {
    const level = match[1].toUpperCase() as ConfidenceLevel;
    return {
      score: LEGACY_SCORE_MAP[level],
      level,
      reasoning: match[2].trim(),
      cleanedText: text.replace(LEGACY_CONFIDENCE_PATTERN, "").trim(),
    };
  }

  // Strategy 4: Try legacy fallback pattern
  match = text.match(LEGACY_FALLBACK_PATTERN);
  if (match && match[1] && match[2]) {
    const level = match[1].toUpperCase() as ConfidenceLevel;
    return {
      score: LEGACY_SCORE_MAP[level],
      level,
      reasoning: match[2].trim(),
      cleanedText: text.replace(LEGACY_FALLBACK_PATTERN, "").trim(),
    };
  }

  // Default fallback - no confidence block found
  return {
    score: 50,
    level: "MEDIUM",
    reasoning: "Confidence assessment not provided or could not be parsed",
    cleanedText: text,
  };
}

export function calculateHeuristicConfidence(text: string): number {
  let confidence = 85;
  const textLower = text.toLowerCase();

  const penalties = [
    { phrase: "i'm not sure", penalty: 30 },
    { phrase: "i don't know", penalty: 40 },
    { phrase: "uncertain", penalty: 25 },
    { phrase: "might be", penalty: 15 },
    { phrase: "possibly", penalty: 10 },
    { phrase: "i think", penalty: 5 },
  ];

  for (const { phrase, penalty } of penalties) {
    if (textLower.includes(phrase)) confidence -= penalty;
  }

  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 2) confidence -= 15;

  return Math.max(0, Math.min(100, confidence));
}
