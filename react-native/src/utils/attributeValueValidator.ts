import type { Logger } from './logger';
import { ATTRIBUTE_KEY_REGEX, ValidationLimits } from './validationLimits';
export type ValidAttributeValue = string | number | boolean;

function isValidKey(key: string): boolean {
  return (
    key.length <= ValidationLimits.maxUserDefinedAttributeKeyLength &&
    ATTRIBUTE_KEY_REGEX.test(key)
  );
}

function isValidValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.length <= ValidationLimits.maxUserDefinedAttributeValueLength;
  }
  return typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Checks if all attributes in a dictionary are valid for Measure events.
 * Keys must match `^[a-zA-Z0-9_-]+$` and be at most 256 characters. Values
 * must be a string of at most 256 characters, a number or a boolean. At most
 * 100 attributes are allowed.
 *
 * @param attributes - The attributes object to validate.
 * @param logger - Logger used to warn about invalid attributes.
 * @returns `true` if all attributes are valid, otherwise `false`.
 */
export function validateAttributes(
  attributes: Record<string, any>,
  logger: Logger
): boolean {
  const entries = Object.entries(attributes);
  if (entries.length > ValidationLimits.maxUserDefinedAttributes) {
    logger.log(
      'warning',
      `Attributes exceed the maximum of ${ValidationLimits.maxUserDefinedAttributes}`
    );
    return false;
  }

  for (const [key, value] of entries) {
    if (!isValidKey(key)) {
      logger.log('warning', `Invalid attribute key '${key}'`);
      return false;
    }

    if (!isValidValue(value)) {
      logger.log(
        'warning',
        `Invalid attribute '${key}' with value: ${JSON.stringify(value)}`
      );
      return false;
    }
  }

  return true;
}

/**
 * Returns only the valid attributes, keeping at most 100. Logs how many were
 * dropped. Used where dropping an attribute is better than dropping the whole
 * signal, such as spans and bug reports.
 *
 * @param name - The signal name, used in the log message.
 * @param attributes - The attributes to filter.
 * @param logger - Logger used to report dropped attributes.
 */
export function dropInvalidAttributes(
  name: string,
  attributes: Record<string, any>,
  logger: Logger
): Record<string, ValidAttributeValue> {
  const entries = Object.entries(attributes);
  const valid = entries
    .filter(([key, value]) => isValidKey(key) && isValidValue(value))
    .slice(0, ValidationLimits.maxUserDefinedAttributes);

  if (valid.length < entries.length) {
    logger.log(
      'warning',
      `Invalid attributes for ${name}: dropped ${entries.length - valid.length} attributes`
    );
  }

  return Object.fromEntries(valid);
}
