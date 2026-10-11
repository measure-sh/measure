-- migrate:up
-- The app hang migrations first shipped as 20260927104500, 20261005100000 and
-- 20261005100100 in commit e2aabb7c9
-- (https://github.com/measure-sh/measure/pull/4577), which merged after
-- 20261003101031 and 20261003101032, so dbmate in strict mode refused them on
-- databases that already had those. They now run as 20261011000000,
-- 20261011000100 and 20261011000200. dbmate records migrations in a
-- ReplacingMergeTree that keeps the newest row per version, so inserting a row
-- with applied = 0 for each old version that was applied leaves the new
-- versions as the only record, and a rollback does not look for a file under an
-- old version.
insert into schema_migrations (version, applied)
select version, 0
from schema_migrations final
where version in ('20260927104500', '20261005100000', '20261005100100')
  and applied = 1;

-- migrate:down
-- Rolling back keeps the old versions unrecorded, since their files no longer
-- exist. A down section cannot be empty, because dbmate sends it to ClickHouse
-- as an empty query and ClickHouse rejects it, so it holds select 1 as a
-- placeholder.
select 1;
