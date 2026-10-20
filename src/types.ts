export type ReviewRating = "known" | "fuzzy" | "unknown";
export type LearningModule =
  "reading" | "listening" | "writing" | "translation";

export interface Word {
  id: string;
  english: string;
  chinese: string;
  notes: string;
  createdAt: string;
  lastReviewedAt: string | null;
  nextReviewDate: string;
  totalReviews: number;
  knownCount: number;
  fuzzyCount: number;
  unknownCount: number;
  streak: number;
  intervalDays: number;
  mastered: boolean;
}

export interface WordReview {
  id: string;
  wordId: string;
  rating: ReviewRating;
  reviewedAt: string;
}

export interface Expression {
  id: string;
  english: string;
  chinese: string;
  topic: string;
  category: string;
  usage: string;
  example?: string;
  sourceType: string;
  keywords?: string[];
}

export interface PersonalExpression extends Expression {
  createdAt: string;
  updatedAt: string;
}

export interface Favorite {
  id: string;
  module: "writing" | "translation";
  expressionId: string;
  createdAt: string;
}

export interface PracticeRecord {
  id: string;
  practiceId: string;
  module: LearningModule;
  answers: Record<string, string>;
  correct: number;
  total: number;
  completedAt: string;
}

export interface Setting {
  id: string;
  value: unknown;
}

export interface AudioRecord {
  id: string;
  name: string;
  blob: Blob;
  createdAt: string;
}
