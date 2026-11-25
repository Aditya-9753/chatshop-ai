const rules = require("./rules");

const MAX_QUESTIONS = (() => {
  const value = Number(process.env.ASSISTANT_MAX_QUESTIONS || 5);
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error("ASSISTANT_MAX_QUESTIONS must be an integer between 1 and 10");
  return value;
})();

function extractParts(text) {
  const source = String(text || "").trim();
  if (!source) return [];

  let parts = source.split(/\?+|[;\n]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    const candidate = source.split(/\s+(?:and also|also|plus|and|aur)\s+/i).map((part) => part.trim()).filter(Boolean);
    if (candidate.length > 1 && candidate.length <= MAX_QUESTIONS) {
      const intents = candidate.map((part) => rules.intentOf(part));
      if (intents.every(Boolean) && new Set(intents).size > 1) parts = candidate;
    }
  }
  return parts;
}

function planQuestions(text) {
  const parts = extractParts(text);

  return {
    overflow: parts.length > MAX_QUESTIONS,
    tasks: parts.slice(0, MAX_QUESTIONS).map((question, index) => ({
      id: `q${index + 1}`,
      index,
      question,
      intent: rules.intentOf(question) || "general",
      dependsOn: [],
    })),
  };
}

module.exports = { planQuestions, MAX_QUESTIONS };
