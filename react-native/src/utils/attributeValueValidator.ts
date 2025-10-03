export type ValidAttributeValue = string | number | boolean;

/**
 * Validates a dictionary of attributes for use in Measure events.
 * Only string, number, and boolean values are allowed.
 * Invalid entries are dropped and logged in development mode.
 *
 * @param attributes - The attributes object to validate.
 * @returns A new object containing only valid attribute key-value pairs.
 */
export function validateAttributes(
  attributes: Record<string, any>
): Record<string, ValidAttributeValue> {
  const validated: Record<string, ValidAttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      validated[key] = value;
    } else {
      if (__DEV__) {
        console.warn(
          `[MeasureRN] Dropping invalid attribute '${key}' with value:`,
          value
        );
      }
    }
  }
  
  return validated;
}