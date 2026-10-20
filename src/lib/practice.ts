export interface GradableQuestion {
  id: string;
  answer: string;
}

export interface GradedAnswer {
  questionId: string;
  selected: string;
  answer: string;
  correct: boolean;
}

/** Called only on submission; leaving an answer blank counts as incorrect. */
export function gradeAnswers(
  questions: GradableQuestion[],
  answers: Record<string, string>,
) {
  const results: GradedAnswer[] = questions.map((question) => ({
    questionId: question.id,
    selected: answers[question.id] ?? "",
    answer: question.answer,
    correct:
      (answers[question.id] ?? "").trim().toUpperCase() ===
      question.answer.trim().toUpperCase(),
  }));
  const correct = results.filter((result) => result.correct).length;
  return {
    correct,
    total: questions.length,
    percentage: questions.length
      ? Math.round((correct / questions.length) * 100)
      : 0,
    results,
  };
}
