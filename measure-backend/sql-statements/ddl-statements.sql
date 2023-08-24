/*
events table schema
*/
create table if not exists
public.events (
  id uuid not null default gen_random_uuid(),
  session_id uuid default null,
  type character varying not null,
  created_at timestamp with time zone null default now(),
  constraint events_pkey primary key (id)
) tablespace pg_default;