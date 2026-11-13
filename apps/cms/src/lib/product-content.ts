export function publicProductFaqs(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => row && typeof row.question === "string" && typeof row.answer === "string" && row.question.trim() && row.answer.trim()
    ? [{ question: row.question.trim(), answer: row.answer.trim() }] : []);
}
