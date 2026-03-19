import { AppError } from './errorHandler.js';

/**
 * Validates that required fields exist and are non-empty strings.
 * Throws AppError(400) if validation fails.
 *
 * Usage:
 *   requireFields(body, ['name', 'userId'])
 */
export function requireFields(obj, fields) {
  for (const field of fields) {
    const val = obj[field];
    if (val === undefined || val === null || val === '') {
      throw new AppError(`Missing required field: ${field}`, 400);
    }
  }
}

/**
 * Validates that blocks is an array of { type, value } objects.
 */
export function validateBlocks(blocks) {
  const VALID_TYPES = ['input', 'prompt', 'rule', 'output'];

  if (!Array.isArray(blocks)) {
    throw new AppError('blocks must be an array', 400);
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b || typeof b !== 'object') {
      throw new AppError(`Block at index ${i} must be an object`, 400);
    }
    if (!VALID_TYPES.includes(b.type)) {
      throw new AppError(`Block at index ${i} has invalid type "${b.type}". Valid: ${VALID_TYPES.join(', ')}`, 400);
    }
    if (typeof b.value !== 'string' || b.value.trim() === '') {
      throw new AppError(`Block at index ${i} must have a non-empty string value`, 400);
    }
  }
}
