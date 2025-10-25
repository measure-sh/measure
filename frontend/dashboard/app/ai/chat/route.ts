import { formatDocSearchResults, searchDocs, TEXT_EMBEDDING_MODEL } from '@/app/utils/rag_utils';
import { convertToModelMessages, hasToolCall, streamText, UIMessage } from 'ai';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { getPosthogServer } from "../../posthog-server";

const posthog = getPosthogServer();
const apiOrigin = process?.env?.API_BASE_URL
const AI_CHAT_AUTH_FAILURE_MSG = "Authentication and refresh failed"

// Tool schemas
const filtersToolSchema = z.object({
    appId: z.string().describe('The app ID to fetch filters for'),
    type: z.enum(['crash', 'anr', 'span', 'all']).optional().describe('Type of filters to fetch. Defaults to all filters if not provided.'),
});

const metricsSchema = z.object({
    appId: z.string().describe('The app ID to fetch metrics for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).describe('Filter by app versions'),
    version_codes: z.array(z.string()).describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
});

const crashGroupsSchema = z.object({
    appId: z.string().describe('The app ID to fetch Crash groups for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    keyId: z.string().optional().describe('Id of Crash group that is used in pagination. If keyId is not provided, results start from the beginning. To paginate, use the id of the last Crash group from previous results.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from KeyId if provided or from the beginning otherwise'),
});

const crashGroupsPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch Crash groups plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
});

const crashGroupInstancesSchema = z.object({
    appId: z.string().describe('The app ID to fetch Crash group instances for'),
    crashGroupId: z.string().describe('The crash group ID to fetch crash group instances for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    keyId: z.string().optional().describe('Id of Crash instance that is used in pagination. If keyId is not provided, results start from the beginning. To paginate, use the id of the last Crash instance from previous results.'),
    keyTimestamp: z.string().optional().describe('Timestamp of Crash instance that is used in pagination. Timestamp should match the timestamp of Id used for KeyId. If KeyId is provided, KeyTimestamp must be provided as well.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from KeyId if provided or from the beginning otherwise'),
});

const crashGroupInstancesPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch Crash group instances plot for'),
    crashGroupId: z.string().describe('The crash group ID to fetch crash group instances plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
});

const crashGroupInstancesDistributionSchema = z.object({
    appId: z.string().describe('The app ID to fetch Crash group instances distribution for'),
    crashGroupId: z.string().describe('The crash group ID to fetch crash group instances distribution for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
});

const anrGroupsSchema = z.object({
    appId: z.string().describe('The app ID to fetch ANR groups for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    keyId: z.string().optional().describe('Id of ANR group that is used in pagination. If keyId is not provided, results start from the beginning. To paginate, use the id of the last ANR group from previous results.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from KeyId if provided or from the beginning otherwise'),
});

const anrGroupsPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch ANR groups plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
});

const anrGroupInstancesSchema = z.object({
    appId: z.string().describe('The app ID to fetch ANR group instances for'),
    anrGroupId: z.string().describe('The ANR group ID to fetch ANR group instances for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    keyId: z.string().optional().describe('Id of ANR instance that is used in pagination. If keyId is not provided, results start from the beginning. To paginate, use the id of the last ANR instance from previous results.'),
    keyTimestamp: z.string().optional().describe('Timestamp of ANR instance that is used in pagination. Timestamp should match the timestamp of Id used for KeyId. If KeyId is provided, KeyTimestamp must be provided as well.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from KeyId if provided or from the beginning otherwise'),
});

const anrGroupInstancesPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch ANR group instances plot for'),
    anrGroupId: z.string().describe('The ANR group ID to fetch ANR group instances plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
});

const anrGroupInstancesDistributionSchema = z.object({
    appId: z.string().describe('The app ID to fetch ANR group instances distribution for'),
    anrGroupId: z.string().describe('The ANR group ID to fetch ANR group instances distribution for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
});

const sessionsSchema = z.object({
    appId: z.string().describe('The app ID to fetch sessions for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    sessionType: z.enum(['crash', 'anr', 'issues', 'all']).optional().describe('Type of sessions to fetch. Defaults to all if not provided. Issues is Crashes along with ANRs. Only applicable for sessions'),
    versions: z.array(z.string()).optional().describe('Filter by app versions.'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    ud_expression: z.string().optional().describe('Filter by user-defined attribute expressions (e.g.,{"and":[{"cmp":{"key":"boolean","type":"bool","op":"eq","value":"false"}},{"cmp":{"key":"double","type":"float64","op":"eq","value":"0"}}]})'),
    freeText: z.string().optional().describe('Free text search across sessions. Can search Search User/Session ID, Logs, Event Type, Target View ID, File/Class name, Exception Traces etc'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const sessionsPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch sessions plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    sessionType: z.enum(['crash', 'anr', 'issues', 'all']).optional().describe('Type of sessions to fetch. Defaults to all if not provided. Issues is Crashes along with ANRs. Only applicable for sessions'),
    versions: z.array(z.string()).optional().describe('Filter by app versions.'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    ud_expression: z.string().optional().describe('Filter by user-defined attribute expressions (e.g.,{"and":[{"cmp":{"key":"boolean","type":"bool","op":"eq","value":"false"}},{"cmp":{"key":"double","type":"float64","op":"eq","value":"0"}}]})'),
    freeText: z.string().optional().describe('Free text search across sessions. Can search Search User/Session ID, Logs, Event Type, Target View ID, File/Class name, Exception Traces etc')
});

const sessionDetailsSchema = z.object({
    appId: z.string().describe('The app ID to fetch session details for'),
    sessionId: z.string().describe('The session ID to fetch details for')
});

const bugReportsSchema = z.object({
    appId: z.string().describe('The app ID to fetch bug reports for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    bugReportStatuses: z.array(z.number()).optional().describe('Filter by bug report statuses (0: OPEN, 1: CLOSED)'),
    versions: z.array(z.string()).optional().describe('Filter by app versions.'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    ud_expression: z.string().optional().describe('Filter by user-defined attribute expressions (e.g.,{"and":[{"cmp":{"key":"boolean","type":"bool","op":"eq","value":"false"}},{"cmp":{"key":"double","type":"float64","op":"eq","value":"0"}}]})'),
    freeText: z.string().optional().describe('Free text search across bug reports. Can search Search User/Session ID, Bug Report Id or Description'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const bugReportsPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch bug reports plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    bugReportStatuses: z.array(z.number()).optional().describe('Filter by bug report statuses (0: OPEN, 1: CLOSED)'),
    versions: z.array(z.string()).optional().describe('Filter by app versions.'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    ud_expression: z.string().optional().describe('Filter by user-defined attribute expressions (e.g.,{"and":[{"cmp":{"key":"boolean","type":"bool","op":"eq","value":"false"}},{"cmp":{"key":"double","type":"float64","op":"eq","value":"0"}}]})'),
    freeText: z.string().optional().describe('Free text search across bug reports. Can search Search User/Session ID, Bug Report Id or Description')
});

const bugReportDetailsSchema = z.object({
    appId: z.string().describe('The app ID to fetch bug report details for'),
    bugReportId: z.string().describe('The bug report ID to fetch details for')
});

const rootSpanNamesSchema = z.object({
    appId: z.string().describe('The app ID to fetch root span names for')
});

const rootSpanInstancesSchema = z.object({
    appId: z.string().describe('The app ID to fetch root span instances for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    rootSpanName: z.string().describe('The root span name to fetch instances for.'),
    spanStatuses: z.array(z.number()).optional().describe('Filter by span statuses (0: UNSET", 1: OK, 2: ERROR)'),
    versions: z.array(z.string()).optional().describe('Filter by app versions.'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    ud_expression: z.string().optional().describe('Filter by user-defined attribute expressions (e.g.,{"and":[{"cmp":{"key":"boolean","type":"bool","op":"eq","value":"false"}},{"cmp":{"key":"double","type":"float64","op":"eq","value":"0"}}]})'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const rootSpanMetricsPlotSchema = z.object({
    appId: z.string().describe('The app ID to fetch root span metrics plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    rootSpanName: z.string().describe('The root span name to fetch metrics plot for.'),
    spanStatuses: z.array(z.number()).optional().describe('Filter by span statuses (0: UNSET", 1: OK, 2: ERROR)'),
    versions: z.array(z.string()).optional().describe('Filter by app versions.'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
    os_names: z.array(z.string()).optional().describe('Filter by OS names (e.g., android, ios)'),
    os_versions: z.array(z.string()).optional().describe('Filter by OS versions (must match os_names array length). If os_names are provided, os_versions must be provided as well.'),
    countries: z.array(z.string()).optional().describe('Filter by country codes (e.g., US, IN, GB)'),
    network_providers: z.array(z.string()).optional().describe('Filter by network providers'),
    network_types: z.array(z.string()).optional().describe('Filter by network types (e.g., wifi, cellular)'),
    network_generations: z.array(z.string()).optional().describe('Filter by network generations (e.g., 4g, 5g)'),
    locales: z.array(z.string()).optional().describe('Filter by device locales (e.g., en_US, es_ES)'),
    device_manufacturers: z.array(z.string()).optional().describe('Filter by device manufacturers (e.g., Samsung, Apple)'),
    device_names: z.array(z.string()).optional().describe('Filter by device names (e.g., iPhone 12, Pixel 5)'),
    ud_expression: z.string().optional().describe('Filter by user-defined attribute expressions (e.g.,{"and":[{"cmp":{"key":"boolean","type":"bool","op":"eq","value":"false"}},{"cmp":{"key":"double","type":"float64","op":"eq","value":"0"}}]})')
});

const traceDetailsSchema = z.object({
    appId: z.string().describe('The app ID to fetch trace details for'),
    traceId: z.string().describe('The trace ID to fetch details for')
});

const alertsSchema = z.object({
    appId: z.string().describe('The app ID to fetch root span instances for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const journeySchema = z.object({
    appId: z.string().describe('The app ID to fetch journeys for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
});

function applyFiltersToUrl(url: string, from: string, to: string, timezone: string, rootSpanName: string | undefined, spanStatuses: string[] | undefined, bugReportStatuses: string[] | undefined, sessionType: string | undefined, versions: string[] | undefined, version_codes: string[] | undefined, os_names: string[] | undefined, os_versions: string[] | undefined, countries: string[] | undefined, network_providers: string[] | undefined, network_types: string[] | undefined, network_generations: string[] | undefined, locales: string[] | undefined, device_manufacturers: string[] | undefined, device_names: string[] | undefined, udExpression: string | undefined, freeText: string | undefined, keyId: string | undefined, keyTimestamp: string | undefined, limit: number | undefined, offset: number | undefined): string {
    const params = new URLSearchParams();

    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (timezone) params.append('timezone', timezone);
    if (rootSpanName) params.append('span_name', rootSpanName);
    spanStatuses?.forEach(status => {
        params.append('span_statuses', status);
    });
    bugReportStatuses?.forEach(status => {
        params.append('bug_report_statuses', status);
    });
    if (sessionType) {
        switch (sessionType) {
            case 'crash':
                params.append('crash', '1');
                break;
            case 'anr':
                params.append('anr', '1');
                break;
            case 'issues':
                params.append('crash', '1');
                params.append('anr', '1');
                break;
            case 'all':
                break;
        }
    }

    if (versions?.length) params.append('versions', versions.join(','));
    if (version_codes?.length) params.append('version_codes', version_codes.join(','));
    if (os_names?.length) params.append('os_names', os_names.join(','));
    if (os_versions?.length) params.append('os_versions', os_versions.join(','));
    if (countries?.length) params.append('countries', countries.join(','));
    if (network_providers?.length) params.append('network_providers', network_providers.join(','));
    if (network_types?.length) params.append('network_types', network_types.join(','));
    if (network_generations?.length) params.append('network_generations', network_generations.join(','));
    if (locales?.length) params.append('locales', locales.join(','));
    if (device_manufacturers?.length) params.append('device_manufacturers', device_manufacturers.join(','));
    if (device_names?.length) params.append('device_names', device_names.join(','));
    if (udExpression) params.append('ud_expression', udExpression);
    if (freeText) params.append('free_text', freeText);
    if (keyId) params.append('key_id', keyId);
    if (keyTimestamp) params.append('key_timestamp', keyTimestamp);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());


    return `${url}?${params.toString()}`;
}

async function checkAuth(request: Request) {
    const cookies = request.headers.get("cookie")
    const headers = new Headers(request.headers)
    headers.set("cookie", cookies || "")

    // Try to validate session
    let res = await fetch(`${apiOrigin}/auth/session`, {
        method: "GET",
        headers: headers,
    })

    let err = ""

    // If session is invalid, try to refresh
    if (!res.ok) {
        err = `AI Chat auth failure: get /auth/session returned ${res.status}, attempting refresh`
        posthog.captureException(err, {
            source: 'ai_chat_auth'
        });
        console.log(err)

        const refreshRes = await fetch(`${apiOrigin}/auth/refresh`, {
            method: "POST",
            headers: headers,
        })

        if (!refreshRes.ok) {
            err = `AI Chat refresh failure: post /auth/refresh returned ${refreshRes.status}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        const refreshData = await refreshRes.json()
        if (refreshData.error) {
            err = `AI Chat refresh failure: post /auth/refresh returned ${refreshData.error}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        // Get new cookies from refresh response
        const rawSetCookies: string[] = [];
        refreshRes.headers.forEach((value, name) => {
            if (name.toLowerCase() === 'set-cookie') {
                rawSetCookies.push(value);
            }
        });

        // Convert Set-Cookie headers into a single Cookie header string
        const cookieHeader = rawSetCookies
            .map(c => c.split(';')[0]) // take only "key=value" part
            .join('; ')

        // Retry session check with refreshed credentials
        const newHeaders = new Headers(headers)
        if (rawSetCookies.length > 0) {
            newHeaders.set("cookie", cookieHeader)
        }

        res = await fetch(`${apiOrigin}/auth/session`, {
            method: "GET",
            headers: newHeaders,
        })

        if (!res.ok) {
            err = `AI Chat auth failure after refresh: get /auth/session returned ${res.status}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        const data = await res.json()
        if (data.error) {
            err = `AI Chat auth failure after refresh: get /auth/session returned ${data.error}`
            posthog.captureException(err, {
                source: 'ai_chat_auth'
            });
            console.log(err)
            return {
                authorized: false,
                error: AI_CHAT_AUTH_FAILURE_MSG,
                newCookies: null
            }
        }

        // Return success with new cookies to forward to client
        return {
            authorized: true,
            userName: data.user.name,
            newCookies: rawSetCookies, // Pass new cookies to be set in response
        }
    }

    // Original session was valid
    const data = await res.json()
    if (data.error) {
        err = `AI Chat auth failure: get /auth/session returned ${data.error}`
        posthog.captureException(err, {
            source: 'ai_chat_auth'
        });
        console.log(err)
        return {
            authorized: false,
            error: AI_CHAT_AUTH_FAILURE_MSG,
            newCookies: null
        }
    }

    return {
        authorized: true,
        userName: data.user.name,
        newCookies: null, // No refresh needed
    }
}

function truncateMessages(messages: UIMessage[], maxRecentMessages = 15): UIMessage[] {
    if (messages.length <= maxRecentMessages) {
        return messages;
    }

    // Always keep first message if it exists
    const firstMessage = messages[0];

    // Keep last N messages
    const recentMessages = messages.slice(-maxRecentMessages);

    // Identify messages with attachments in the middle section
    const middleMessages = messages.slice(1, -maxRecentMessages);
    const messagesWithAttachments = middleMessages.filter(msg =>
        msg.parts.some(part => part.type === 'file')
    );

    // Build final message array
    const truncatedMessages: UIMessage[] = [firstMessage];

    // Add messages with attachments from middle
    truncatedMessages.push(...messagesWithAttachments);

    // Add recent messages
    truncatedMessages.push(...recentMessages);

    return truncatedMessages;
}

function extractLastUserQuery(messages: any[]): string {
    const lastUserMessage = messages
        .filter(m => m.role === 'user')
        .pop();

    if (!lastUserMessage) return '';

    return lastUserMessage.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ');
}

export async function POST(req: Request) {
    let err = ""

    // Ensure AI is configured
    if (!process.env.AI_GATEWAY_API_KEY) {
        err = "Measure AI is not configured. Please set up Measure AI to use this feature. See https://github.com/measure-sh/measure/blob/main/docs/hosting/ai.md for more details."
        posthog.captureException(err, {
            source: 'ai_chat_config'
        });
        console.log(err)
        return new Response(
            JSON.stringify({ error: err }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }

    // Check authentication with refresh fallback
    const authResult = await checkAuth(req)

    if (!authResult.authorized) {
        return new Response(
            JSON.stringify({ error: authResult.error || 'Unauthorized' }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }

    const {
        teamId,
        appId,
        timezone,
        messages,
        model,
    }: {
        teamId: string
        appId: string
        timezone: string
        messages: UIMessage[]
        model: string
    } = await req.json()

    const { userName } = authResult

    // log team id and app id
    console.log(`AI Chat request for team: ${teamId}, app: ${appId}`);

    const truncatedMessages = truncateMessages(messages, 15);

    // RAG: Search relevant documentation based on user's query
    let relevantDocs = '';
    try {
        const userQuery = extractLastUserQuery(truncatedMessages);

        if (userQuery) {
            console.log(`Searching docs for: "${userQuery.slice(0, 100)}..."`);

            const docSearchResult = await searchDocs(userQuery, 5); // Get top 5 relevant chunks
            relevantDocs = formatDocSearchResults(docSearchResult.results);

            reportAiUsage(teamId, TEXT_EMBEDDING_MODEL, docSearchResult.inputTokens, 0, authResult, req);

            console.log(`Found ${docSearchResult.results.length} relevant doc chunks. Used ${docSearchResult.inputTokens} tokens for embedding.`);
        }
    } catch (error) {
        // Continue without RAG if it fails
        console.error('RAG search error:', error);
    }

    // Build system prompt with relevant documentation
    const systemPrompt = `
    You are **Measure AI**, a helpful and expert assistant for Android, iOS, Flutter, and React Native developers.
    You help debug and analyze mobile applications that use the **Measure SDK** for performance monitoring.

    ---

    ## 🧠 What You Can Do
    You are capable of:
    - Answering questions about mobile app development and Measure usage  
    - Using tools to fetch information about crashes, anrs, traces, bug reports, alerts and user journeys
    - Debugging Crashes, ANRs, Traces, and Bug Reports for apps that use Measure  

    If the user asks for something unrelated to these areas, politely tell them you cannot help with that.

    ---

    ## ⚙️ Current Context
    - **User:** ${userName}  
    - **Team ID:** ${teamId}  
    - **App ID:** ${appId !== '' ? appId : "No app_id provided"}  
    - **Timezone:** ${timezone}
    - **Current Time:** ${DateTime.now().setZone(timezone).toISO()}

    Always assume that the app currently being analyzed has **app_id = "${appId}"**.  
    If app_id is missing or empty, clearly tell the user that app_id is required before running any query.

    ---

    ## 🗄️ Tools
    You have access to tools that let you fetch data from the user's Measure dashboard.

    When doing so:
    1. First use the getFilters tool to understand what filters are available.
    2. For tools that have required parameters, ensure you have all required parameters before calling the tool. Usually, you will need filters from getFilters tool to call other tools.
    3. If going for a wide search, apply all filters as described by the schema.
    4. Date range (from, to) must be provided, if user hasn't asked for a specific date range, use last 12 months as default.
    5. For filters that come in pairs (versions & version_codes, os_names & os_versions), if you provide one, you must provide the other and they must match in length
    6. Android os version numbers correspond to API levels (e.g., 33 = Android 13). When displaying them to user, show them as 'Android API Level XX' for clarity.
    7. Example of filters passed as params: http://localhost:3000/api/apps/19e26d60-2ad8-4ef7-8aab-333e1f5377fc/crashGroups?from=2024-10-09T10%3A11%3A47.866Z&to=2025-10-09T10%3A11%3A47.866Z&timezone=Asia%2FCalcutta&bug_report_statuses=0&limit=5&versions=0.11.0-SNAPSHOT,0.11.0-SNAPSHOT,0.10.0-SNAPSHOT,0.10.0-SNAPSHOT&version_codes=29137627,29099904,29045653,29043935&os_names=android,android,android&os_versions=36,33,27&countries=IN&network_providers=unknown&network_types=wifi&network_generations=unknown&locales=en-IN,en-US&device_manufacturers=Google,Xiaomi&device_names=emu64a,sunfish,tiare

    ---

    ## 📘 Measure Documentation
    The following documentation sections may be relevant:

    <measure_documentation>
    ${relevantDocs || "No specific documentation was found for this query."}
    </measure_documentation>

    When referencing documentation:
    1. Prioritize Measure's official docs for factual accuracy.  
    2. Cite files with full GitHub links, e.g.  
    [filename](https://github.com/measure-sh/measure/blob/main/docs/filename.md)
    3. Distinguish between information from the documentation and general best practices.
    4. If something is not covered by the docs, say “The documentation does not cover this.”

    ---

    ## 🧱 Answer Formatting
    - Write clearly and conversationally.
    - Format code snippets using Markdown with language tags (e.g. \`\`\`kotlin\`\`\`, \`\`\`swift\`\`\`).
    - Never show raw database or API responses directly.
    - Summarize data in human-readable tables or bullet points when appropriate.

    ---
    End of system instructions.
    `;
    const result = streamText({
        model: model,
        messages: convertToModelMessages(truncatedMessages),
        system: systemPrompt,
        tools: {
            getFilters: {
                description: `Get available filter options for an app. Optionally filter by type: 'crash', 'anr', 'span', or 'all' (default).`,
                inputSchema: filtersToolSchema,
                execute: async ({ appId, type }) => {
                    const params = new URLSearchParams();
                    params.append('ud_attr_keys', '1');
                    switch (type) {
                        case 'crash':
                            params.append('crash', '1');
                            break;
                        case 'anr':
                            params.append('anr', '1');
                            break;
                        case 'span':
                            params.append('span', '1');
                            break;
                        case 'all':
                        default:
                            break;
                    }

                    const response = await fetch(
                        `${apiOrigin}/apps/${appId}/filters?${params.toString()}`,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch filters: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getMetrics: {
                description: `Get metrics for an app with filters. At least one app version must be provided. Deltas are comparisons of selected versions vs all unselected version. Deltas are returned as x times worse or better (1.5x launch time means launch time is 1.5x compared to all unselected versions). Metrics provided: adoption, crash free sessions, perceived crash free sessions, anr free sessions, perceived anr free sessions, cold launch time, warm launch time, hot launch time, app size (only returned for single app version. Stored as bytes. Should be shown in MiB but labelled as MB).`,
                inputSchema: metricsSchema,
                execute: async ({ appId, from, to, timezone, versions, version_codes }) => {
                    const url = `${apiOrigin}/apps/${appId}/metrics`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch metrics: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getCrashGroups: {
                description: `Get crash groups data for an app with optional filters.`,
                inputSchema: crashGroupsSchema,
                execute: async ({ appId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, keyId, limit }) => {
                    const url = `${apiOrigin}/apps/${appId}/crashGroups`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, keyId, undefined, limit, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch Crash groups: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getCrashGroupsPlot: {
                description: `Get plot of Crash groups occurences over time for an app with optional filters.`,
                inputSchema: crashGroupsPlotSchema,
                execute: async ({ appId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                    const url = `${apiOrigin}/apps/${appId}/crashGroups/plots/instances`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch Crash groups plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getCrashGroupInstances: {
                description: `Get crash group instances data for a crash group with optional filters. Use with getCrashGroups tool to get crashGroupId. Set limit 1 to get the latest crash instance along with detailed stack trace.`,
                inputSchema: crashGroupInstancesSchema,
                execute: async ({ appId, crashGroupId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, keyId, keyTimestamp, limit }) => {
                    const url = `${apiOrigin}/apps/${appId}/crashGroups/${crashGroupId}/crashes`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, keyId, keyTimestamp, limit, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch Crash group instances: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                }
            },
            getCrashGroupInstancesPlot: {
                description: `Get plot of Crash group instances over time for a crash group with optional filters. Use with getCrashGroups tool to get crashGroupId.`,
                inputSchema: crashGroupInstancesPlotSchema,
                execute: async ({ appId, crashGroupId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                    const url = `${apiOrigin}/apps/${appId}/crashGroups/${crashGroupId}/plots/instances`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch Crash group instances plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                }
            },
            getCrashGroupInstancesDistribution: {
                description: `Get Crash group instances distribution by app versions, countries, devices, network types and os versions for a crash group with optional filters. Use with getCrashGroups tool to get crashGroupId.`,
                inputSchema: crashGroupInstancesDistributionSchema,
                execute: async ({ appId, crashGroupId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                    const url = `${apiOrigin}/apps/${appId}/crashGroups/${crashGroupId}/plots/distribution`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch Crash group instances distribution: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                }
            },
            getAnrGroups: {
                description: `Get ANR groups data for an app with optional filters.`,
                inputSchema: anrGroupsSchema,
                execute: async ({ appId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, keyId, limit }) => {
                    const url = `${apiOrigin}/apps/${appId}/anrGroups`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, keyId, undefined, limit, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch ANR groups: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getAnrGroupsPlot: {
                description: `Get plot of ANR groups occurrences over time for an app with optional filters.`,
                inputSchema: anrGroupsPlotSchema,
                execute: async ({ appId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                    const url = `${apiOrigin}/apps/${appId}/anrGroups/plots/instances`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch ANR groups plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getAnrGroupInstances: {
                description: `Get ANR group instances data for a ANR group with optional filters. Use with getAnrGroups tool to get anrGroupId. Set limit 1 to get the latest ANR instance along with detailed stack trace.`,
                inputSchema: anrGroupInstancesSchema,
                execute: async ({ appId, anrGroupId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, keyId, keyTimestamp, limit }) => {
                    const url = `${apiOrigin}/apps/${appId}/anrGroups/${anrGroupId}/anrs`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, keyId, keyTimestamp, limit, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch ANR group instances: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getAnrGroupInstancesPlot: {
                description: `Get plot of ANR group instances over time for a ANR group with optional filters. Use with getAnrGroups tool to get anrGroupId.`,
                inputSchema: anrGroupInstancesPlotSchema,
                execute: async ({ appId, anrGroupId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                    const url = `${apiOrigin}/apps/${appId}/anrGroups/${anrGroupId}/plots/instances`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch ANR group instances plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getAnrGroupInstancesDistribution: {
                description: `Get ANR group instances distribution by app versions, countries, devices, network types and os versions for a ANR group with optional filters. Use with getAnrGroups tool to get anrGroupId.`,
                inputSchema: anrGroupInstancesDistributionSchema,
                execute: async ({ appId, anrGroupId, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                    const url = `${apiOrigin}/apps/${appId}/anrGroups/${anrGroupId}/plots/distribution`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch ANR group instances distribution: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getSessions: {
                description: `Get sessions for an app with optional filters ordered by most recent first.`,
                inputSchema: sessionsSchema,
                execute: async ({ appId, from, to, timezone, sessionType, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText, limit, offset }) => {
                    const url = `${apiOrigin}/apps/${appId}/sessions`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, sessionType, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText, undefined, undefined, limit, offset);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch sessions: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getSessionsPlot: {
                description: `Get plot of sessions over time for an app with optional filters.`,
                inputSchema: sessionsPlotSchema,
                execute: async ({ appId, from, to, timezone, sessionType, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText }) => {
                    const url = `${apiOrigin}/apps/${appId}/sessions/plots/instances`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, sessionType, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch sessions plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getSessionDetails: {
                description: `Get session details for an individual session.`,
                inputSchema: sessionDetailsSchema,
                execute: async ({ appId, sessionId }) => {
                    const url = `${apiOrigin}/apps/${appId}/sessions/${sessionId}`;

                    const response = await fetch(
                        url,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch session details: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getBugReports: {
                description: `Get bug reports for an app with optional filters ordered by most recent first.`,
                inputSchema: bugReportsSchema,
                execute: async ({ appId, from, to, timezone, bugReportStatuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText, limit, offset }) => {
                    const url = `${apiOrigin}/apps/${appId}/bugReports`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, bugReportStatuses, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText, undefined, undefined, limit, offset);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch bug reports: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getBugReportsPlot: {
                description: `Get plot of bug reports over time for an app with optional filters.`,
                inputSchema: bugReportsPlotSchema,
                execute: async ({ appId, from, to, timezone, bugReportStatuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText }) => {
                    const url = `${apiOrigin}/apps/${appId}/bugReports/plots/instances`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, bugReportStatuses, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, freeText, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch bug reports plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getBugReportDetails: {
                description: `Get bug report details for an individual bug report.`,
                inputSchema: bugReportDetailsSchema,
                execute: async ({ appId, bugReportId }) => {
                    const url = `${apiOrigin}/apps/${appId}/bugReports/${bugReportId}`;

                    const response = await fetch(
                        url,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch bug report details: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getRootSpanNames: {
                description: `Get root span names for an app.`,
                inputSchema: rootSpanNamesSchema,
                execute: async ({ appId }) => {
                    const url = `${apiOrigin}/apps/${appId}/spans/roots/names`;

                    const response = await fetch(
                        url,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch root span names: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getRootSpanInstances: {
                description: `Get instances for an app and root span with optional filters ordered by most recent first.`,
                inputSchema: rootSpanInstancesSchema,
                execute: async ({ appId, from, to, timezone, rootSpanName, spanStatuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, limit, offset }) => {
                    const url = `${apiOrigin}/apps/${appId}/spans`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, rootSpanName, spanStatuses, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, undefined, undefined, undefined, limit, offset);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch root span instances: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getRootSpanMetricsPlot: {
                description: `Get plot of p50, p90, p95, p99 metrics over time for an app and root span with optional filters.`,
                inputSchema: rootSpanMetricsPlotSchema,
                execute: async ({ appId, from, to, timezone, rootSpanName, spanStatuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression }) => {
                    const url = `${apiOrigin}/apps/${appId}/spans/plots/metrics`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, rootSpanName, spanStatuses, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch root span metrics plot: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getTraceDetails: {
                description: `Get trace details for an individual trace.`,
                inputSchema: traceDetailsSchema,
                execute: async ({ appId, traceId }) => {
                    const url = `${apiOrigin}/apps/${appId}/traces/${traceId}`;

                    const response = await fetch(
                        url,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch trace details: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getAlerts: {
                description: `Get alerts for an app with optional filters ordered by most recent first.`,
                inputSchema: alertsSchema,
                execute: async ({ appId, from, to, timezone, limit, offset }) => {
                    const url = `${apiOrigin}/apps/${appId}/alerts`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, limit, offset);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch alerts: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
            getJourney: {
                description: `Get journey for an app with optional filters. Journey shows user navigation paths within the app along with session counts between nodes. It also provides Crashes and ANR occurences on each node.`,
                inputSchema: journeySchema,
                execute: async ({ appId, from, to, timezone, versions, version_codes }) => {
                    const url = `${apiOrigin}/apps/${appId}/journey`;
                    const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

                    const response = await fetch(
                        finalUrl,
                        {
                            method: 'GET',
                            headers: {
                                "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch journey: ${response.status}`);
                    }

                    const data = await response.json();
                    return data;
                },
            },
        },
        stopWhen: [hasToolCall("finalAnswer")],
    })

    const { inputTokens, outputTokens } = await result.totalUsage;
    await reportAiUsage(teamId, model, inputTokens, outputTokens, authResult, req);

    const response = result.toUIMessageStreamResponse({
        sendSources: true,
        sendReasoning: true,
        originalMessages: messages
    })

    // If tokens were refreshed, forward new cookies to client
    if (authResult.newCookies) {
        const responseHeaders = new Headers(response.headers)

        if (authResult.newCookies?.length) {
            const responseHeaders = new Headers(response.headers)

            for (const cookie of authResult.newCookies) {
                responseHeaders.append("Set-Cookie", cookie)
            }

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
            })
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        })
    }

    return response
}

async function reportAiUsage(teamId: string, model: string, inputTokens: number | undefined, outputTokens: number | undefined, authResult: { authorized: boolean; error: any; newCookies: null; userName?: undefined; } | { authorized: boolean; userName: any; newCookies: string[] | null; error?: undefined; }, req: Request) {
    let err = ""
    fetch(`${apiOrigin}/teams/${teamId}/usage/ai`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "cookie": authResult.newCookies?.map(c => c.split(';')[0]).join('; ') || req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
            "team_id": teamId,
            "model": model,
            "input_tokens": inputTokens,
            "output_tokens": outputTokens
        }),
    }).then(res => {
        if (!res.ok) {
            err = `Failed to report AI usage: post /teams/${teamId}/usage/ai returned ${res.status}`
            posthog.captureException(err, {
                source: 'ai_chat_usage'
            });
            console.log(err);
        }
    }).catch(err => {
        err = `Error reporting AI usage: ${err}`
        posthog.captureException(err, {
            source: 'ai_chat_usage'
        });
        console.log(`Error reporting AI usage: ${err}`);
    });
}
