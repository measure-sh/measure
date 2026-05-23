-- migrate:up

CREATE TABLE IF NOT EXISTS measure.github_star_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repo TEXT NOT NULL,
  starred_at DATE NOT NULL,
  star_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_github_star_history_repo_date UNIQUE (repo, starred_at)
);

COMMENT ON TABLE measure.github_star_history IS 'Daily GitHub star count snapshots for tracked repositories';
COMMENT ON COLUMN measure.github_star_history.repo IS 'GitHub repository slug in owner/name format';
COMMENT ON COLUMN measure.github_star_history.starred_at IS 'Date on which the star count snapshot was recorded';
COMMENT ON COLUMN measure.github_star_history.star_count IS 'Total star count recorded on that date';

-- migrate:down

DROP TABLE IF EXISTS measure.github_star_history;
