/**
 * Field limits enforced by the backend.
 */
export const ValidationLimits = {
  userId: 128,
  patchVersion: 256,
  screenViewName: 1024,
  httpClient: 32,
  bugReportDescription: 4000,

  maxUserDefinedAttributes: 100,
  maxUserDefinedAttributeKeyLength: 256,
  maxUserDefinedAttributeValueLength: 256,

  expoRuntimeVersion: 128,
  expoAutomaticUpdatePolicy: 32,
  expoExecutionEnvironment: 32,
  expoVersion: 32,
  expoSdkVersion: 32,
  expoEasProjectId: 64,
} as const;

export const ATTRIBUTE_KEY_REGEX = /^[a-zA-Z0-9_-]+$/;

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
