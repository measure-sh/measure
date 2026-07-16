import type { Logger } from './logger';
export type ValidAttributeValue = string | number | boolean;

/**
 * Checks if all attributes in a dictionary are valid for Measure events.
 * Only string, number, and boolean values are considered valid.
 *
 * @param attributes - The attributes object to validate.
 * @param logger - Logger used to warn about invalid attributes.
 * @returns `true` if all attributes are valid, otherwise `false`.
 */
export function validateAttributes(
  attributes: Record<string, any>,
  logger: Logger
): boolean {
  for (const [key, value] of Object.entries(attributes)) {
    const isValid =
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';

    if (!isValid) {
      logger.log(
        'warning',
        `Invalid attribute '${key}' with value: ${JSON.stringify(value)}`
      );
      return false;
    }
  }

  return true;
}
