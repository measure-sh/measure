SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: dbmate; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA dbmate;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: create_team(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_team() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
declare
  team_id uuid;
  team_name text;
  user_name text;
  inviter_team_id uuid;
  invitee_role text;
  time_now timestamptz;
begin
  -- noop if account has not been confirmed
  if new.confirmed_at is null and old.confirmed_at is null then
    return new;
  end if;

  -- prepare new user's team name
  user_name = new.raw_user_meta_data->>'name';
  if user_name is not null then
    team_name = substring(user_name from 1 for position(' ' in user_name) - 1);
  else
    team_name = substring(new.email from 1 for position('@' in new.email) - 1);
  end if;

  -- get invite details
  inviter_team_id = new.raw_user_meta_data->'invite'->>'teamId';
  invitee_role = new.raw_user_meta_data->'invite'->>'role';

  -- update tables
  time_now = now();
  if new.confirmed_at is not null and old.confirmed_at is null then
    insert into public.teams (name, updated_at) values (team_name || '''s team', time_now) returning id into team_id;
    insert into public.team_membership (team_id, user_id, role, role_updated_at) values (team_id, new.id, 'owner', time_now);
    if inviter_team_id is not null and invitee_role is not null then
      insert into public.team_membership (team_id, user_id, role, role_updated_at) values (inviter_team_id::uuid, new.id, invitee_role, time_now);
    end if;
  end if;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: schema_migrations; Type: TABLE; Schema: dbmate; Owner: -
--

CREATE TABLE dbmate.schema_migrations (
    version character varying(128) NOT NULL
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid,
    key_prefix character varying(16) NOT NULL,
    key_value character varying(256) NOT NULL,
    checksum character varying(16) NOT NULL,
    revoked boolean DEFAULT false,
    last_seen timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN api_keys.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.id IS 'unique id for each api key';


--
-- Name: COLUMN api_keys.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.app_id IS 'linked app id';


--
-- Name: COLUMN api_keys.key_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_prefix IS 'constant prefix for the key';


--
-- Name: COLUMN api_keys.key_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_value IS 'key value';


--
-- Name: COLUMN api_keys.checksum; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.checksum IS 'checksum of key value';


--
-- Name: COLUMN api_keys.revoked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.revoked IS 'has the key been revoked earlier';


--
-- Name: COLUMN api_keys.last_seen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.last_seen IS 'utc timestamp at the time of last key usage seen';


--
-- Name: COLUMN api_keys.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.created_at IS 'utc timestamp at the time of api key creation';


--
-- Name: apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    unique_identifier character varying(512),
    app_name character varying(512),
    platform character varying(256),
    first_version character varying(128),
    first_seen_at timestamp with time zone,
    onboarded boolean DEFAULT false,
    onboarded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT apps_platform_check CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'flutter'::character varying, 'react-native'::character varying, 'unity'::character varying])::text[])))
);


--
-- Name: COLUMN apps.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.id IS 'unique id for each app';


--
-- Name: COLUMN apps.team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.team_id IS 'team id that this app belongs to';


--
-- Name: COLUMN apps.unique_identifier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.unique_identifier IS 'unique id lingua franca to app creator';


--
-- Name: COLUMN apps.app_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.app_name IS 'name of app lingua franca to app creator';


--
-- Name: COLUMN apps.platform; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.platform IS 'platform of the app, like iOS, Android, Flutter';


--
-- Name: COLUMN apps.first_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.first_version IS 'first version of the app as per ingested sessions from it';


--
-- Name: COLUMN apps.first_seen_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.first_seen_at IS 'utc timestamp as per the nascent ingested session';


--
-- Name: COLUMN apps.onboarded; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.onboarded IS 'app is considered onboarded once it receives the first session';


--
-- Name: COLUMN apps.onboarded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.onboarded_at IS 'utc timestamp at the time of receiving first session';


--
-- Name: COLUMN apps.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.created_at IS 'utc timestamp at the time of app record creation';


--
-- Name: COLUMN apps.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps.updated_at IS 'utc timestamp at the time of app record updation';


--
-- Name: mapping_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mapping_files (
    id uuid NOT NULL,
    app_unique_id character varying(256) NOT NULL,
    version_name character varying(256) NOT NULL,
    version_code character varying(256) NOT NULL,
    mapping_type character varying(32) NOT NULL,
    key character varying(256) NOT NULL,
    location character varying NOT NULL,
    fnv1_hash character varying(34) NOT NULL,
    file_size integer DEFAULT 0,
    last_updated timestamp with time zone NOT NULL
);


--
-- Name: COLUMN mapping_files.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.id IS 'unique id for each mapping file';


--
-- Name: COLUMN mapping_files.app_unique_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.app_unique_id IS 'unique identifier of the app';


--
-- Name: COLUMN mapping_files.version_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.version_name IS 'user visible version number of the app';


--
-- Name: COLUMN mapping_files.version_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.version_code IS 'incremental build number of the app';


--
-- Name: COLUMN mapping_files.mapping_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.mapping_type IS 'type of the mapping file, like proguard etc';


--
-- Name: COLUMN mapping_files.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.key IS 'key of the mapping file stored in remote object store';


--
-- Name: COLUMN mapping_files.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.location IS 'url of the mapping file stored in remote object store';


--
-- Name: COLUMN mapping_files.fnv1_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.fnv1_hash IS '64 bit fnv1 hash of the mapping file bytes';


--
-- Name: COLUMN mapping_files.file_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.file_size IS 'size of mapping file in bytes';


--
-- Name: COLUMN mapping_files.last_updated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mapping_files.last_updated IS 'utc timestamp at the time of mapping file upload';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    name character varying(256) NOT NULL,
    scopes text[],
    CONSTRAINT roles_name_check CHECK (((name)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'developer'::character varying, 'viewer'::character varying])::text[])))
);


--
-- Name: COLUMN roles.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.name IS 'unique role name';


--
-- Name: COLUMN roles.scopes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.scopes IS 'valid scopes for this role';


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    app_id uuid,
    event_count integer DEFAULT 0,
    attachment_count integer DEFAULT 0,
    bytes_in integer DEFAULT 0,
    symbolication_attempts_count integer DEFAULT 0,
    "timestamp" timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN sessions.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.id IS 'unique uuidv4 session id';


--
-- Name: COLUMN sessions.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.app_id IS 'app id of the app this session belongs to';


--
-- Name: COLUMN sessions.event_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.event_count IS 'number of events in the session';


--
-- Name: COLUMN sessions.attachment_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.attachment_count IS 'number of attachments in the session';


--
-- Name: COLUMN sessions.bytes_in; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.bytes_in IS 'total session payload size in bytes';


--
-- Name: COLUMN sessions.symbolication_attempts_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.symbolication_attempts_count IS 'number of times symbolication was attempted for this session';


--
-- Name: COLUMN sessions."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions."timestamp" IS 'utc timestamp at the time of session ingestion';


--
-- Name: COLUMN sessions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.created_at IS 'utc timestamp at the time of record creation';


--
-- Name: COLUMN sessions.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.updated_at IS 'utc timestamp at the time of record updation';


--
-- Name: sessions_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions_attachments (
    id uuid NOT NULL,
    session_id uuid,
    name character varying(256) NOT NULL,
    extension character varying(32) NOT NULL,
    type character varying(32) NOT NULL,
    key character varying(256) NOT NULL,
    location character varying NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);


--
-- Name: COLUMN sessions_attachments.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.id IS 'unique id for each session attachment';


--
-- Name: COLUMN sessions_attachments.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.session_id IS 'session_id of the containing session';


--
-- Name: COLUMN sessions_attachments.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.name IS 'original name of the attachment file';


--
-- Name: COLUMN sessions_attachments.extension; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.extension IS 'original extension of the attachment file';


--
-- Name: COLUMN sessions_attachments.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.type IS 'type of attachment, like screenshot etc';


--
-- Name: COLUMN sessions_attachments.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.key IS 'key of the attachment file stored in remote object store';


--
-- Name: COLUMN sessions_attachments.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments.location IS 'url of the attachment file stored in remote object store';


--
-- Name: COLUMN sessions_attachments."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions_attachments."timestamp" IS 'utc timestamp at the time of attachment file upload';


--
-- Name: team_membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid,
    user_id uuid,
    role character varying(256),
    role_updated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: COLUMN team_membership.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_membership.id IS 'unique id for each team membership';


--
-- Name: COLUMN team_membership.team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_membership.team_id IS 'team id to which user is a member of';


--
-- Name: COLUMN team_membership.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_membership.user_id IS 'user id of user having membership of team';


--
-- Name: COLUMN team_membership.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_membership.role IS 'role of the invitee';


--
-- Name: COLUMN team_membership.role_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_membership.role_updated_at IS 'utc timestamp at the time of role change';


--
-- Name: COLUMN team_membership.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_membership.created_at IS 'utc timestamp at the time of team membership';


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN teams.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.id IS 'unique id for each team';


--
-- Name: COLUMN teams.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.name IS 'name of the team';


--
-- Name: COLUMN teams.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.created_at IS 'utc timestamp at the time of team creation';


--
-- Name: COLUMN teams.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.updated_at IS 'utc timestmap at the time of team name update';


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: dbmate; Owner: -
--

ALTER TABLE ONLY dbmate.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: apps apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps
    ADD CONSTRAINT apps_pkey PRIMARY KEY (id);


--
-- Name: mapping_files mapping_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mapping_files
    ADD CONSTRAINT mapping_files_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (name);


--
-- Name: sessions_attachments sessions_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_attachments
    ADD CONSTRAINT sessions_attachments_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: team_membership team_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_membership
    ADD CONSTRAINT team_membership_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE DEFERRABLE;


--
-- Name: apps apps_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps
    ADD CONSTRAINT apps_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


--
-- Name: sessions_attachments sessions_attachments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_attachments
    ADD CONSTRAINT sessions_attachments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: team_membership team_membership_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_membership
    ADD CONSTRAINT team_membership_role_fkey FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE;


--
-- Name: team_membership team_membership_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_membership
    ADD CONSTRAINT team_membership_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_membership team_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_membership
    ADD CONSTRAINT team_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


--
-- Dbmate schema migrations
--

INSERT INTO dbmate.schema_migrations (version) VALUES
    ('20231117010312'),
    ('20231117010526'),
    ('20231117010802'),
    ('20231117011042'),
    ('20231117011737'),
    ('20231117012011'),
    ('20231117012219'),
    ('20231117012557'),
    ('20231117012726'),
    ('20231122211412');
