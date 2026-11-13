/**
 * Core Activity Model and Validation Logic
 */

export const PRIORITIES = Object.freeze({
  P1_URGENT: 'P1_URGENT',
  P2_HIGH: 'P2_HIGH',
  P3_MEDIUM: 'P3_MEDIUM',
  P4_LOW: 'P4_LOW'
});

export const PRIORITY_LABELS = Object.freeze({
  P1_URGENT: 'P1 - Urgent',
  P2_HIGH: 'P2 - High',
  P3_MEDIUM: 'P3 - Medium',
  P4_LOW: 'P4 - Low'
});

export const PRIORITY_WEIGHTS = Object.freeze({
  P1_URGENT: 1,
  P2_HIGH: 2,
  P3_MEDIUM: 3,
  P4_LOW: 4
});

/**
 * Validates raw activity input
 */
export function validateActivityInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('ERR_VALIDATION_INPUT: Input must be a non-null object');
  }

  const title = (input.title || '').trim();
  if (!title) {
    throw new Error('ERR_VALIDATION_TITLE: Title is required and cannot be empty');
  }

  const date = (input.date || '').trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !dateRegex.test(date) || isNaN(Date.parse(date))) {
    throw new Error('ERR_VALIDATION_DATE: Date must be valid YYYY-MM-DD');
  }

  let priority = input.priority;
  if (!priority || !Object.values(PRIORITIES).includes(priority)) {
    priority = PRIORITIES.P3_MEDIUM;
  }

  return {
    title,
    date,
    priority,
    description: (input.description || '').trim(),
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    category: (input.category || 'General').trim() || 'General'
  };
}

/**
 * Generate lightweight collision-resistant ID
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Factory for complete Activity record
 */
export function createActivityModel(rawInput) {
  const validated = validateActivityInput(rawInput);
  const now = new Date().toISOString();

  return {
    id: rawInput.id || generateId(),
    ...validated,
    completed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Toggles completion status and updates completedAt
 */
export function toggleActivityCompletion(activity) {
  if (!activity || typeof activity !== 'object') {
    throw new Error('ERR_INVALID_ACTIVITY: Expected activity object');
  }

  const isCompleted = !activity.completed;
  const now = new Date().toISOString();

  return {
    ...activity,
    completed: isCompleted,
    completedAt: isCompleted ? now : null,
    updatedAt: now
  };
}

