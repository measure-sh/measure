-- migrate:up
DROP TABLE measure.app_settings;

-- migrate:down
CREATE TABLE measure.app_settings (
  app_id uuid NOT NULL,
  retention_period integer NOT NULL DEFAULT 90,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE measure.app_settings
ADD CONSTRAINT app_settings_pkey PRIMARY KEY (app_id);