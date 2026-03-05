export interface StrengthResult {
  score: number; // 0 to 100
  label: "Weak" | "Good" | "Overcooked" | "Perfect";
  color: string;
  details: string[];
}

export function analyzePromptStrength(prompt: string): StrengthResult {
  const tags = prompt.split(',').map(t => t.trim()).filter(t => t.length > 0);
  const details: string[] = [];
  let score = 0;

  // Length analysis
  if (tags.length < 5) {
    details.push("Prompt is too short. Add more descriptive tags.");
    score += 20;
  } else if (tags.length > 40) {
    details.push("Prompt is getting very long. This can lead to 'overcooked' results where the AI loses focus.");
    score += 40;
  } else {
    score += 60;
  }

  // Redundancy check (Simple string similarity or exact match)
  const uniqueTags = new Set(tags.map(t => t.toLowerCase()));
  if (uniqueTags.size < tags.length) {
    details.push("Exact duplicate tags detected. This wastes tokens.");
    score -= 10;
  }

  // Overlap check (e.g., "lying on back" and "lying on chair")
  const words = prompt.toLowerCase().split(/[\s,()]+/).filter(w => w.length > 3);
  const wordCounts: Record<string, number> = {};
  words.forEach(w => {
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  });

  const redundantWords = Object.entries(wordCounts).filter(([_, count]) => count > 3).map(([word]) => word);
  if (redundantWords.length > 0) {
    details.push(`High repetition of words like "${redundantWords.slice(0, 2).join(', ')}". This might 'overcook' specific features.`);
    score -= 15;
  }

  // Weight analysis (e.g., (word:1.5))
  const weights = prompt.match(/\(([^)]+):([0-9.]+)\)/g) || [];
  const highWeights = weights.filter(w => {
    const val = parseFloat(w.split(':')[1]);
    return val > 1.4;
  });

  if (highWeights.length > 0) {
    details.push(`${highWeights.length} tags have high weights (>1.4). High weights can cause artifacts or 'burnt' pixels.`);
    score -= 15;
  }

  // Common quality tags check
  const qualityKeywords = ["masterpiece", "best quality", "highly detailed", "ultra-detailed", "8k", "4k", "hdr"];
  const hasQuality = qualityKeywords.some(k => prompt.toLowerCase().includes(k));
  if (hasQuality) {
    score += 20;
  } else {
    details.push("Missing quality keywords (e.g., 'masterpiece', '8k').");
  }

  // Conflicting terms (simple check)
  if (prompt.toLowerCase().includes("blurry") && prompt.toLowerCase().includes("sharp")) {
    details.push("Conflicting terms detected: 'blurry' and 'sharp'.");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let label: StrengthResult["label"] = "Good";
  let color = "bg-emerald-500";

  if (score < 40) {
    label = "Weak";
    color = "bg-amber-500";
  } else if (score > 85 && tags.length > 40) {
    label = "Overcooked";
    color = "bg-orange-500";
  } else if (score >= 80) {
    label = "Perfect";
    color = "bg-indigo-500";
  }

  return { score, label, color, details };
}
