# Migration Guide for Adding Default Targeting Rules

Use this guide to add default targeting rules to existing apps in your Measure installation.

> [!WARNING]
>
> Steps mentioned in this document will cause downtime.

Follow these steps to populate default targeting rules for all existing apps. There is some downtime involved. During the downtime, the Measure dashboard may be unavailable. Once the migration is complete, all services should resume normally.

## 1. SSH into the VM where Measure is hosted

## 2. Navigate to the self-host directory
```sh
cd ~/measure/self-host
```

## 3. Run the targeting rules migration script

This script will add default targeting rules (event, session, and trace rules) for all existing apps in your Measure installation.
```sh
sudo ./migrations/v0.10.x-add-default-targeting-rules.sh
```

The script will:
- Start the PostgreSQL service
- Insert default event targeting rules per app
- Insert default session targeting rules per app
- Insert default trace targeting rule per app
- Shutdown the PostgreSQL service

## 4. Verify the migration

You can verify that the rules were added successfully by checking the database:
```sh
sudo docker compose -f compose.yml -f compose.prod.yml exec postgres psql -U postgres -d measure -c "SELECT count(*) FROM measure.event_targeting_rules;"
```
```sh
sudo docker compose -f compose.yml -f compose.prod.yml exec postgres psql -U postgres -d measure -c "SELECT count(*) FROM measure.session_targeting_rules;"
```
```sh
sudo docker compose -f compose.yml -f compose.prod.yml exec postgres psql -U postgres -d measure -c "SELECT count(*) FROM measure.trace_targeting_rules;"
```

## Expected Results

If you have `N` apps in your system, you should see:
- Event targeting rules: `7 × N` rows
- Session targeting rules: `3 × N` rows
- Trace targeting rules: `1 × N` rows

## Troubleshooting

If the migration fails:

1. Check the error message in the console output
2. Ensure the PostgreSQL service is accessible
3. Verify that the `measure.apps` table exists and contains data
4. Check that the targeting rules tables exist and have the correct schema

You can safely re-run the migration script if needed - it will insert additional rules, so make sure to clean up any partial data first if you need to retry:
```sh
sudo docker compose -f compose.yml -f compose.prod.yml exec postgres psql -U postgres -d measure -c "DELETE FROM measure.event_targeting_rules; DELETE FROM measure.session_targeting_rules; DELETE FROM measure.trace_targeting_rules;"
```