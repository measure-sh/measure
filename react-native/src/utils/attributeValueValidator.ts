export type ValidAttributeValue = string | number | boolean;

/**
 * Checks if all attributes in a dictionary are valid for Measure events.
 * Only string, number, and boolean values are considered valid.
 *
 * @param attributes - The attributes object to validate.
 * @returns `true` if all attributes are valid, otherwise `false`.
 */
export function validateAttributes(
  attributes: Record<string, any>
): boolean {
  for (const [key, value] of Object.entries(attributes)) {
    const isValid =
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';

    if (!isValid) {
      if (__DEV__) {
        console.warn(
          `[MeasureRN] Invalid attribute '${key}' with value:`,
          value
        );
      }
      return false;
    }
  }

  return true;
}