/**
 * Reading Goal & Annual Challenge Pacing Engine (Issue #41)
 * Calculates progress, day-of-year pacing, and completion milestones.
 */

export interface GoalPacingResult {
  year: number;
  goal: number;
  readCount: number;
  remainingBooks: number;
  percentage: number;
  rawPercentage: number;
  isCompleted: boolean;
  status: "completed" | "ahead" | "behind" | "on-track";
  diffBooks: number;
  paceMessage: string;
  expectedByNow: number;
  daysRemaining: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function calculateReadingGoalPacing(
  totalReadThisYear: number,
  goal: number,
  targetYear?: number,
  currentDate: Date = new Date()
): GoalPacingResult {
  const safeGoal = Math.max(1, goal || 12);
  const safeRead = Math.max(0, totalReadThisYear || 0);
  const year = targetYear || currentDate.getFullYear();
  const totalDays = isLeapYear(year) ? 366 : 365;

  // Determine current day within the target year
  let dayOfYear: number;
  if (currentDate.getFullYear() > year) {
    // Year in the past
    dayOfYear = totalDays;
  } else if (currentDate.getFullYear() < year) {
    // Future year
    dayOfYear = 1;
  } else {
    // Current year
    dayOfYear = Math.min(totalDays, Math.max(1, getDayOfYear(currentDate)));
  }

  const daysRemaining = Math.max(0, totalDays - dayOfYear);
  const expectedByNow = (dayOfYear / totalDays) * safeGoal;
  const diff = safeRead - expectedByNow;
  const roundedDiff = Math.round(Math.abs(diff));
  const isCompleted = safeRead >= safeGoal;
  const percentage = Math.min(100, Math.round((safeRead / safeGoal) * 100));
  const rawPercentage = Math.round((safeRead / safeGoal) * 1000) / 10;
  const remainingBooks = Math.max(0, safeGoal - safeRead);

  let status: "completed" | "ahead" | "behind" | "on-track";
  let paceMessage: string;

  if (isCompleted) {
    status = "completed";
    const overGoal = safeRead - safeGoal;
    paceMessage = overGoal > 0
      ? `Goal achieved! You're ${overGoal} book${overGoal > 1 ? "s" : ""} past your target!`
      : "Challenge completed! You crushed your reading goal for the year! 🎉";
  } else if (diff >= 0.75) {
    status = "ahead";
    paceMessage = `${roundedDiff} book${roundedDiff > 1 ? "s" : ""} ahead of schedule`;
  } else if (diff <= -0.75) {
    status = "behind";
    paceMessage = `${roundedDiff} book${roundedDiff > 1 ? "s" : ""} behind pace`;
  } else {
    status = "on-track";
    paceMessage = "Right on track to reach your goal!";
  }

  return {
    year,
    goal: safeGoal,
    readCount: safeRead,
    remainingBooks,
    percentage,
    rawPercentage,
    isCompleted,
    status,
    diffBooks: roundedDiff,
    paceMessage,
    expectedByNow: Math.round(expectedByNow * 10) / 10,
    daysRemaining,
  };
}
