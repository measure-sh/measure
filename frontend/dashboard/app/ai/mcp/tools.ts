import { getPosthogServer } from '@/app/posthog-server';
import { z } from 'zod/v3';
import { formatDocSearchResults, searchDocs, TEXT_EMBEDDING_MODEL } from '../rag';
import { reportAiUsage } from './report_ai_usage';

const posthog = getPosthogServer();
const apiOrigin = process?.env?.API_BASE_URL

// Tool schemas
const docsToolSchema = z.object({
    userQuery: z.string().describe('The user query to search documents for'),
});

const appsToolSchema = z.object({
});

const filtersToolSchema = z.object({
    app_id: z.string().describe('The app ID to fetch filters for'),
    type: z.enum(['crash', 'anr', 'span', 'all']).optional().describe('Type of filters to fetch. Defaults to all filters if not provided.'),
});

const metricsSchema = z.object({
    app_id: z.string().describe('The app ID to fetch metrics for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).describe('Filter by app versions'),
    version_codes: z.array(z.string()).describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
});

const crashGroupsSchema = z.object({
    app_id: z.string().describe('The app ID to fetch Crash groups for'),
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
    key_id: z.string().optional().describe('Id of Crash group that is used in pagination. If key_id is not provided, results start from the beginning. To paginate, use the id of the last Crash group from previous results.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from key_id if provided or from the beginning otherwise'),
});

const crashGroupsPlotSchema = z.object({
    app_id: z.string().describe('The app ID to fetch Crash groups plot for'),
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
    app_id: z.string().describe('The app ID to fetch Crash group instances for'),
    crash_group_id: z.string().describe('The crash group ID to fetch crash group instances for'),
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
    key_id: z.string().optional().describe('Id of Crash instance that is used in pagination. If key_id is not provided, results start from the beginning. To paginate, use the id of the last Crash instance from previous results.'),
    key_timestamp: z.string().optional().describe('Timestamp of Crash instance that is used in pagination. Timestamp should match the timestamp of Id used for key_id. If key_id is provided, Key_timestamp must be provided as well.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from key_id if provided or from the beginning otherwise'),
});

const crashGroupInstancesPlotSchema = z.object({
    app_id: z.string().describe('The app ID to fetch Crash group instances plot for'),
    crash_group_id: z.string().describe('The crash group ID to fetch crash group instances plot for'),
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
    app_id: z.string().describe('The app ID to fetch Crash group instances distribution for'),
    crash_group_id: z.string().describe('The crash group ID to fetch crash group instances distribution for'),
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
    app_id: z.string().describe('The app ID to fetch ANR groups for'),
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
    key_id: z.string().optional().describe('Id of ANR group that is used in pagination. If key_id is not provided, results start from the beginning. To paginate, use the id of the last ANR group from previous results.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from key_id if provided or from the beginning otherwise'),
});

const anrGroupsPlotSchema = z.object({
    app_id: z.string().describe('The app ID to fetch ANR groups plot for'),
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
    app_id: z.string().describe('The app ID to fetch ANR group instances for'),
    anr_group_id: z.string().describe('The ANR group ID to fetch ANR group instances for'),
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
    key_id: z.string().optional().describe('Id of ANR instance that is used in pagination. If key_id is not provided, results start from the beginning. To paginate, use the id of the last ANR instance from previous results.'),
    key_timestamp: z.string().optional().describe('Timestamp of ANR instance that is used in pagination. Timestamp should match the timestamp of Id used for key_id. If key_id is provided, Key_timestamp must be provided as well.'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from key_id if provided or from the beginning otherwise'),
});

const anrGroupInstancesPlotSchema = z.object({
    app_id: z.string().describe('The app ID to fetch ANR group instances plot for'),
    anr_group_id: z.string().describe('The ANR group ID to fetch ANR group instances plot for'),
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
    app_id: z.string().describe('The app ID to fetch ANR group instances distribution for'),
    anr_group_id: z.string().describe('The ANR group ID to fetch ANR group instances distribution for'),
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
    app_id: z.string().describe('The app ID to fetch sessions for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    session_type: z.enum(['crash', 'anr', 'issues', 'all']).optional().describe('Type of sessions to fetch. Defaults to all if not provided. Issues is Crashes along with ANRs. Only applicable for sessions'),
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
    free_text: z.string().optional().describe('Free text search across sessions. Can search Search User/Session ID, Logs, Event Type, Target View ID, File/Class name, Exception Traces etc'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const sessionsPlotSchema = z.object({
    app_id: z.string().describe('The app ID to fetch sessions plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    session_type: z.enum(['crash', 'anr', 'issues', 'all']).optional().describe('Type of sessions to fetch. Defaults to all if not provided. Issues is Crashes along with ANRs. Only applicable for sessions'),
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
    free_text: z.string().optional().describe('Free text search across sessions. Can search Search User/Session ID, Logs, Event Type, Target View ID, File/Class name, Exception Traces etc')
});

const sessionDetailsSchema = z.object({
    app_id: z.string().describe('The app ID to fetch session details for'),
    session_id: z.string().describe('The session ID to fetch details for')
});

const bugReportsSchema = z.object({
    app_id: z.string().describe('The app ID to fetch bug reports for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    bug_report_statuses: z.array(z.number()).optional().describe('Filter by bug report statuses (0: OPEN, 1: CLOSED)'),
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
    free_text: z.string().optional().describe('Free text search across bug reports. Can search Search User/Session ID, Bug Report Id or Description'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const bugReportsPlotSchema = z.object({
    app_id: z.string().describe('The app ID to fetch bug reports plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    bug_report_statuses: z.array(z.number()).optional().describe('Filter by bug report statuses (0: OPEN, 1: CLOSED)'),
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
    free_text: z.string().optional().describe('Free text search across bug reports. Can search Search User/Session ID, Bug Report Id or Description')
});

const bugReportDetailsSchema = z.object({
    app_id: z.string().describe('The app ID to fetch bug report details for'),
    bug_report_id: z.string().describe('The bug report ID to fetch details for')
});

const rootSpanNamesSchema = z.object({
    app_id: z.string().describe('The app ID to fetch root span names for')
});

const rootSpanInstancesSchema = z.object({
    app_id: z.string().describe('The app ID to fetch root span instances for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    root_span_name: z.string().describe('The root span name to fetch instances for.'),
    span_statuses: z.array(z.number()).optional().describe('Filter by span statuses (0: UNSET", 1: OK, 2: ERROR)'),
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
    app_id: z.string().describe('The app ID to fetch root span metrics plot for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    root_span_name: z.string().describe('The root span name to fetch metrics plot for.'),
    span_statuses: z.array(z.number()).optional().describe('Filter by span statuses (0: UNSET", 1: OK, 2: ERROR)'),
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
    app_id: z.string().describe('The app ID to fetch trace details for'),
    trace_id: z.string().describe('The trace ID to fetch details for')
});

const alertsSchema = z.object({
    app_id: z.string().describe('The app ID to fetch root span instances for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    limit: z.number().optional().describe('Number of results to return (default 5) starting from offset if provided or from the beginning otherwise'),
    offset: z.number().optional().describe('Offset for pagination (default 0). Results start from offset if provided or from the beginning otherwise'),
});

const journeySchema = z.object({
    app_id: z.string().describe('The app ID to fetch journeys for'),
    from: z.string().describe('Start date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    to: z.string().describe('End date in ISO format. ex: "1982-05-25T00:00:00.000Z"'),
    timezone: z.string().describe('Timezone name, e.g., Asia/Calcutta'),
    versions: z.array(z.string()).optional().describe('Filter by app versions'),
    version_codes: z.array(z.string()).optional().describe('Filter by version codes (must match versions array length). If versions are provided, version_codes must be provided as well.'),
});

function applyFiltersToUrl(url: string, from: string, to: string, timezone: string, root_span_name: string | undefined, span_statuses: string[] | undefined, bug_report_statuses: string[] | undefined, session_type: string | undefined, versions: string[] | undefined, version_codes: string[] | undefined, os_names: string[] | undefined, os_versions: string[] | undefined, countries: string[] | undefined, network_providers: string[] | undefined, network_types: string[] | undefined, network_generations: string[] | undefined, locales: string[] | undefined, device_manufacturers: string[] | undefined, device_names: string[] | undefined, udExpression: string | undefined, free_text: string | undefined, key_id: string | undefined, key_timestamp: string | undefined, limit: number | undefined, offset: number | undefined): string {
    const params = new URLSearchParams();

    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (timezone) params.append('timezone', timezone);
    if (root_span_name) params.append('span_name', root_span_name);
    span_statuses?.forEach(status => {
        params.append('span_statuses', status);
    });
    bug_report_statuses?.forEach(status => {
        params.append('bug_report_statuses', status);
    });
    if (session_type) {
        switch (session_type) {
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
    if (free_text) params.append('free_text', free_text);
    if (key_id) params.append('key_id', key_id);
    if (key_timestamp) params.append('key_timestamp', key_timestamp);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());


    return `${url}?${params.toString()}`;
}

const toolExtraDescription = `
When using tools:
1. If you don't have app ID, use getApps tool to get available apps for the team and ask user to pick one. If they don't pick one, select the first app.
2. If you have app ID, First use the getFilters tool to understand what filters are available. Only use filters that are available for tool parameters.
3. For tools that have required parameters, ensure you have all required parameters before calling the tool. Usually, you will need filters from getFilters tool to call other tools.
4. If going for a wide search, apply all filters as described by the schema.
5. Date range (from, to) must be provided, if user hasn't asked for a specific date range, use last 30 days as default.
6. Dates must be in ISO format (e.g., "1982-05-25T00:00:00.000Z").
7. Timezone must be a valid timezone name (e.g., Asia/Calcutta).
8. For filters that come in pairs (versions & version_codes, os_names & os_versions), if you provide one, you must provide the other and they must match in length
9. Android os version numbers correspond to API levels (e.g., 33 = Android 13). When displaying them to user, show them as 'Android API Level XX' for clarity.
`

export const getToolSchemas = (source: string, userId: string, teamId: string, cookie: string | null, mcpKey: string | null) => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    if (cookie) {
        headers["cookie"] = cookie;
    }

    if (mcpKey) {
        headers["Authorization"] = `Bearer ${mcpKey}`;
    }

    return {
        getDocs: {
            description: `Get documentation based on user query. This should be used when user asks for Measure documentation or guidance on using Measure features.
                        
            When referencing documentation:
            1. Prioritize Measure's official docs for factual accuracy.  
            2. Cite files with full GitHub links, e.g.[filename](https://github.com/measure-sh/measure/blob/main/docs/filename.md)
            3. Distinguish between information from the documentation and general best practices.
            4. If something is not covered by the docs, say “The documentation does not cover this.”
            5. If user is using self-hosted Measure, try to reference relevant sections of the docs that relate to self-hosting. If not self hosted, prioritize Measure Cloud related docs if available.
            `,
            inputSchema: docsToolSchema,
            // @ts-ignore
            execute: async ({ userQuery }) => {

                const docSearchResult = await searchDocs(userQuery, 5); // Get top 5 relevant chunks
                const relevantDocs = formatDocSearchResults(docSearchResult.results);

                await reportAiUsage(teamId, userId, source, TEXT_EMBEDDING_MODEL, docSearchResult.inputTokens, 0, cookie, mcpKey);

                console.log(`Found ${docSearchResult.results.length} relevant doc chunks. Used ${docSearchResult.inputTokens} tokens for embedding.`);

                return relevantDocs;
            },
        },
        getApps: {
            description: `Get available apps for a team. This should only be used if app ID is not provided or invalid.` + toolExtraDescription,
            inputSchema: appsToolSchema,
            // @ts-ignore
            execute: async ({ }) => {

                const response = await fetch(
                    `${apiOrigin}/mcp/teams/${teamId}/apps`,
                    {
                        method: 'GET',
                        headers: headers,
                    }
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch teams: ${response.status}`);
                }

                const data = await response.json();
                return data;
            },
        },
        getFilters: {
            description: `Get available filter options for an app. Optionally filter by type: 'crash', 'anr', 'span', or 'all' (default).` + toolExtraDescription,
            inputSchema: filtersToolSchema,
            // @ts-ignore
            execute: async ({ app_id, type }) => {
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
                    `${apiOrigin}/mcp/apps/${app_id}/filters?${params.toString()}`,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, versions, version_codes }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/metrics`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, key_id, limit }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/crashGroups`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, key_id, undefined, limit, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/crashGroups/plots/instances`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            description: `Get crash group instances data for a crash group with optional filters. Use with getCrashGroups tool to get crash_group_id. Set limit 1 to get the latest crash instance along with detailed stack trace.`,
            inputSchema: crashGroupInstancesSchema,
            // @ts-ignore
            execute: async ({ app_id, crash_group_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, key_id, key_timestamp, limit }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/crashGroups/${crash_group_id}/crashes`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, key_id, key_timestamp, limit, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            description: `Get plot of Crash group instances over time for a crash group with optional filters. Use with getCrashGroups tool to get crash_group_id.`,
            inputSchema: crashGroupInstancesPlotSchema,
            // @ts-ignore
            execute: async ({ app_id, crash_group_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/crashGroups/${crash_group_id}/plots/instances`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            description: `Get Crash group instances distribution by app versions, countries, devices, network types and os versions for a crash group with optional filters. Use with getCrashGroups tool to get crash_group_id.`,
            inputSchema: crashGroupInstancesDistributionSchema,
            // @ts-ignore
            execute: async ({ app_id, crash_group_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/crashGroups/${crash_group_id}/plots/distribution`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, key_id, limit }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/anrGroups`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, key_id, undefined, limit, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/anrGroups/plots/instances`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            description: `Get ANR group instances data for a ANR group with optional filters. Use with getAnrGroups tool to get anr_group_id. Set limit 1 to get the latest ANR instance along with detailed stack trace.`,
            inputSchema: anrGroupInstancesSchema,
            // @ts-ignore
            execute: async ({ app_id, anr_group_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, key_id, key_timestamp, limit }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/anrGroups/${anr_group_id}/anrs`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, key_id, key_timestamp, limit, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            description: `Get plot of ANR group instances over time for a ANR group with optional filters. Use with getAnrGroups tool to get anr_group_id.`,
            inputSchema: anrGroupInstancesPlotSchema,
            // @ts-ignore
            execute: async ({ app_id, anr_group_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/anrGroups/${anr_group_id}/plots/instances`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            description: `Get ANR group instances distribution by app versions, countries, devices, network types and os versions for a ANR group with optional filters. Use with getAnrGroups tool to get anr_group_id.`,
            inputSchema: anrGroupInstancesDistributionSchema,
            // @ts-ignore
            execute: async ({ app_id, anr_group_id, from, to, timezone, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/anrGroups/${anr_group_id}/plots/distribution`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, session_type, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text, limit, offset }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/sessions`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, session_type, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text, undefined, undefined, limit, offset);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, session_type, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/sessions/plots/instances`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, session_type, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, session_id }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/sessions/${session_id}`;

                const response = await fetch(
                    url,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, bug_report_statuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text, limit, offset }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/bugReports`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, bug_report_statuses, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text, undefined, undefined, limit, offset);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, bug_report_statuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/bugReports/plots/instances`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, bug_report_statuses, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, free_text, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, bug_report_id }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/bugReports/${bug_report_id}`;

                const response = await fetch(
                    url,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/spans/roots/names`;

                const response = await fetch(
                    url,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, root_span_name, span_statuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, limit, offset }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/spans`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, root_span_name, span_statuses, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, undefined, undefined, undefined, limit, offset);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, root_span_name, span_statuses, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/spans/plots/metrics`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, root_span_name, span_statuses, undefined, undefined, versions, version_codes, os_names, os_versions, countries, network_providers, network_types, network_generations, locales, device_manufacturers, device_names, udExpression, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, trace_id }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/traces/${trace_id}`;

                const response = await fetch(
                    url,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, limit, offset }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/alerts`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, limit, offset);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
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
            // @ts-ignore
            execute: async ({ app_id, from, to, timezone, versions, version_codes }) => {
                const url = `${apiOrigin}/mcp/apps/${app_id}/journey`;
                const finalUrl = applyFiltersToUrl(url, from, to, timezone, undefined, undefined, undefined, undefined, versions, version_codes, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

                const response = await fetch(
                    finalUrl,
                    {
                        method: 'GET',
                        headers: headers,
                    }
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch journey: ${response.status}`);
                }

                const data = await response.json();
                return data;
            },
        },
    }
}