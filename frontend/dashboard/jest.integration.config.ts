/**
 * Jest config for MSW integration tests.
 *
 * Separate from the main jest.config.ts because next/jest forces
 * transformIgnorePatterns: ["/node_modules/"] which prevents MSW's
 * ESM transitive deps (rettime, etc.) from being transformed.
 *
 * Run with: npm run test:integration
 */
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

export default async () => {
    const baseConfig = await createJestConfig({
        clearMocks: true,
        testEnvironment: 'jsdom',
        moduleNameMapper: {
            '^@/(.*)$': '<rootDir>/$1',
        },
        // next/jest + jsdom can't resolve msw subpath exports (msw/node).
        // The custom conditions tell jest-environment-jsdom's resolver to
        // follow the `node` → `require` export condition.
        testEnvironmentOptions: {
            customExportConditions: ['node', 'node-addons'],
        },
        globals: {
            fetch: () => { },
            Request: function () { },
        },
    })()

    return {
        ...baseConfig,
        // Override next/jest's blanket node_modules ignore so MSW and its
        // ESM deps get transformed. All other node_modules are still skipped.
        transformIgnorePatterns: [
            '/node_modules/(?!(msw|@mswjs|rettime|until-async|@bundled-es-modules|@open-draft)/)',
            '^.+\\.module\\.(css|sass|scss)$',
        ],
        // Skip Next.js build output so jest-haste-map doesn't see duplicate
        // package.json from .next/standalone/ (output: "standalone" in next.config.js)
        modulePathIgnorePatterns: ["<rootDir>/.next/"],
        // Only run integration tests
        testMatch: ['**/__tests__/integration/**/*.[jt]s?(x)'],
        // Polyfill Fetch API globals (Response, Request, etc.) after jsdom
        // initializes but before test modules load. `setupFiles` runs too
        // early (before jsdom), so we use `setupFilesAfterEnv`.
        setupFilesAfterEnv: [
            '<rootDir>/__tests__/msw/jest-polyfills.ts',
        ],
        // Don't collect coverage — integration tests measure behavior, not lines
        collectCoverage: false,
        // TanStack Query integration tests need slightly longer for async chains
        testTimeout: 10000,
    }
}
