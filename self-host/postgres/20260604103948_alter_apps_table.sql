-- migrate:up
DO $$
BEGIN
    -- Drop old constraint if it exists
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'apps_platform_check'
          AND conrelid = 'measure.apps'::regclass
    ) THEN
        ALTER TABLE measure.apps
        DROP CONSTRAINT apps_platform_check;
    END IF;

    -- Add new constraint only if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'apps_os_name_check'
          AND conrelid = 'measure.apps'::regclass
    ) THEN
        ALTER TABLE measure.apps
        ADD CONSTRAINT apps_os_name_check
        CHECK (
            os_name::text = ANY (ARRAY[
                'ios',
                'android',
                'flutter',
                'react-native',
                'unity',
                'ipados'
            ]::text[])
        );
    END IF;
END $$;

-- migrate:down
DO $$
BEGIN
    -- Drop new constraint if it exists
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'apps_os_name_check'
          AND conrelid = 'measure.apps'::regclass
    ) THEN
        ALTER TABLE measure.apps
        DROP CONSTRAINT apps_os_name_check;
    END IF;

    -- Recreate original constraint only if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'apps_platform_check'
          AND conrelid = 'measure.apps'::regclass
    ) THEN
        ALTER TABLE measure.apps
        ADD CONSTRAINT apps_platform_check
        CHECK (
            os_name::text = ANY (ARRAY[
                'ios',
                'android',
                'flutter',
                'react-native',
                'unity'
            ]::text[])
        );
    END IF;
END $$;
