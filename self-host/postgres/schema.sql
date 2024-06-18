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
    SET search_path TO 'public'
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
  user_name = new.name;
  if user_name is not null then
    team_name = substring(user_name from 1 for position(' ' in user_name) - 1);
  else
    team_name = substring(new.email from 1 for position('@' in new.email) - 1);
  end if;

  -- get invite details
  inviter_team_id = new.invited_to_team_id;
  invitee_role = new.invited_as_role;

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
-- Name: alert_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_prefs (
    app_id uuid NOT NULL,
    user_id uuid NOT NULL,
    crash_rate_spike_email boolean NOT NULL,
    anr_rate_spike_email boolean NOT NULL,
    launch_time_spike_email boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN alert_prefs.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.app_id IS 'linked app id';


--
-- Name: COLUMN alert_prefs.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.user_id IS 'linked user id';


--
-- Name: COLUMN alert_prefs.crash_rate_spike_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.crash_rate_spike_email IS 'team admin/owner set pref for enabling email on crash rate spike';


--
-- Name: COLUMN alert_prefs.anr_rate_spike_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.anr_rate_spike_email IS 'team admin/owner set pref for enabling email on ANR rate spike';


--
-- Name: COLUMN alert_prefs.launch_time_spike_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.launch_time_spike_email IS 'team admin/owner set pref for enabling email on launch time spike';


--
-- Name: COLUMN alert_prefs.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.created_at IS 'utc timestamp at the time of record creation';


--
-- Name: COLUMN alert_prefs.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_prefs.updated_at IS 'utc timestamp at the time of record update';


--
-- Name: anr_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anr_groups (
    id uuid NOT NULL,
    app_id uuid,
    name text NOT NULL,
    fingerprint character varying(16) NOT NULL,
    event_ids uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN anr_groups.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.id IS 'sortable unique id (uuidv7) for each anr group';


--
-- Name: COLUMN anr_groups.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.app_id IS 'linked app id';


--
-- Name: COLUMN anr_groups.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.name IS 'name of the anr for easy identification';


--
-- Name: COLUMN anr_groups.fingerprint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.fingerprint IS 'fingerprint of the anr';


--
-- Name: COLUMN anr_groups.event_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.event_ids IS 'list of associated event ids';


--
-- Name: COLUMN anr_groups.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.created_at IS 'utc timestamp at the time of record creation';


--
-- Name: COLUMN anr_groups.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.anr_groups.updated_at IS 'utc timestamp at the time of record updation';


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
-- Name: build_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_mappings (
    id uuid NOT NULL,
    app_id uuid,
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
-- Name: COLUMN build_mappings.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.id IS 'unique id for each mapping file';


--
-- Name: COLUMN build_mappings.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.app_id IS 'linked app id';


--
-- Name: COLUMN build_mappings.version_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.version_name IS 'user visible version number of the app';


--
-- Name: COLUMN build_mappings.version_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.version_code IS 'incremental build number of the app';


--
-- Name: COLUMN build_mappings.mapping_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.mapping_type IS 'type of the mapping file, like proguard etc';


--
-- Name: COLUMN build_mappings.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.key IS 'key of the mapping file stored in remote object store';


--
-- Name: COLUMN build_mappings.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.location IS 'url of the mapping file stored in remote object store';


--
-- Name: COLUMN build_mappings.fnv1_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.fnv1_hash IS '64 bit fnv1 hash of the mapping file bytes';


--
-- Name: COLUMN build_mappings.file_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.file_size IS 'size of mapping file in bytes';


--
-- Name: COLUMN build_mappings.last_updated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_mappings.last_updated IS 'utc timestamp at the time of mapping file upload';


--
-- Name: build_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid,
    version_name character varying(256) NOT NULL,
    version_code character varying(256) NOT NULL,
    build_size integer DEFAULT 0,
    build_type character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN build_sizes.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.id IS 'unique id for each build size';


--
-- Name: COLUMN build_sizes.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.app_id IS 'linked app id';


--
-- Name: COLUMN build_sizes.version_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.version_name IS 'user visible version number of the app';


--
-- Name: COLUMN build_sizes.version_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.version_code IS 'incremental build number of the app';


--
-- Name: COLUMN build_sizes.build_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.build_size IS 'build size of the app';


--
-- Name: COLUMN build_sizes.build_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.build_type IS 'type of build. can be `aab` or `apk`';


--
-- Name: COLUMN build_sizes.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_sizes.created_at IS 'utc timestamp at the time of record creation';


--
-- Name: event_reqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_reqs (
    id uuid NOT NULL,
    app_id uuid,
    event_count integer DEFAULT 0,
    attachment_count integer DEFAULT 0,
    session_count integer DEFAULT 0,
    bytes_in integer DEFAULT 0,
    symbolication_attempts_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN event_reqs.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.id IS 'id of the event request';


--
-- Name: COLUMN event_reqs.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.app_id IS 'id of the associated app';


--
-- Name: COLUMN event_reqs.event_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.event_count IS 'number of events in the event request';


--
-- Name: COLUMN event_reqs.attachment_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.attachment_count IS 'number of attachments in the event request';


--
-- Name: COLUMN event_reqs.session_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.session_count IS 'number of sessions in the event request';


--
-- Name: COLUMN event_reqs.bytes_in; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.bytes_in IS 'total payload size of the request';


--
-- Name: COLUMN event_reqs.symbolication_attempts_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.symbolication_attempts_count IS 'number of times symbolication was attempted for this event request';


--
-- Name: COLUMN event_reqs.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_reqs.created_at IS 'utc timestamp at the time of record creation';


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
-- Name: unhandled_exception_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unhandled_exception_groups (
    id uuid NOT NULL,
    app_id uuid,
    name text NOT NULL,
    fingerprint character varying(16) NOT NULL,
    event_ids uuid[] NOT NULL,
    first_event_timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN unhandled_exception_groups.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.id IS 'sortable unique id (uuidv7) for each unhandled exception group';


--
-- Name: COLUMN unhandled_exception_groups.app_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.app_id IS 'linked app id';


--
-- Name: COLUMN unhandled_exception_groups.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.name IS 'name of the exception for easy identification';


--
-- Name: COLUMN unhandled_exception_groups.fingerprint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.fingerprint IS 'fingerprint of the unhandled exception';


--
-- Name: COLUMN unhandled_exception_groups.event_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.event_ids IS 'list of associated event ids';


--
-- Name: COLUMN unhandled_exception_groups.first_event_timestamp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.first_event_timestamp IS 'utc timestamp of the oldest event in the group';


--
-- Name: COLUMN unhandled_exception_groups.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.created_at IS 'utc timestamp at the time of record creation';


--
-- Name: COLUMN unhandled_exception_groups.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.unhandled_exception_groups.updated_at IS 'utc timestamp at the time of record updation';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying(256),
    email character varying(256) NOT NULL,
    invited_by_user_id uuid,
    invited_to_team_id uuid,
    invited_as_role character varying(256),
    confirmed_at timestamp with time zone,
    last_sign_in_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id IS 'unique id for each user';


--
-- Name: COLUMN users.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.name IS 'name of the user';


--
-- Name: COLUMN users.invited_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.invited_by_user_id IS 'id of user who invited this user';


--
-- Name: COLUMN users.invited_to_team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.invited_to_team_id IS 'id of team to which this user was invited';


--
-- Name: COLUMN users.invited_as_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.invited_as_role IS 'role as which this user was invited';


--
-- Name: COLUMN users.confirmed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.confirmed_at IS 'utc timestamp at which user was confirmed';


--
-- Name: COLUMN users.last_sign_in_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.last_sign_in_at IS 'utc timestamp at the time of last user sign in';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.created_at IS 'utc timestamp at the time of user creation';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.updated_at IS 'utc timestmap at the time of user update';


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: dbmate; Owner: -
--

ALTER TABLE ONLY dbmate.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: alert_prefs alert_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_prefs
    ADD CONSTRAINT alert_prefs_pkey PRIMARY KEY (app_id, user_id);


--
-- Name: anr_groups anr_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anr_groups
    ADD CONSTRAINT anr_groups_pkey PRIMARY KEY (id);


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
-- Name: build_mappings build_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_mappings
    ADD CONSTRAINT build_mappings_pkey PRIMARY KEY (id);


--
-- Name: build_sizes build_sizes_app_id_version_name_version_code_build_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_sizes
    ADD CONSTRAINT build_sizes_app_id_version_name_version_code_build_type_key UNIQUE (app_id, version_name, version_code, build_type);


--
-- Name: build_sizes build_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_sizes
    ADD CONSTRAINT build_sizes_pkey PRIMARY KEY (id);


--
-- Name: event_reqs event_reqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reqs
    ADD CONSTRAINT event_reqs_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (name);


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
-- Name: unhandled_exception_groups unhandled_exception_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unhandled_exception_groups
    ADD CONSTRAINT unhandled_exception_groups_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users create_team_for_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_team_for_user AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.create_team();


--
-- Name: alert_prefs alert_prefs_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_prefs
    ADD CONSTRAINT alert_prefs_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


--
-- Name: alert_prefs alert_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_prefs
    ADD CONSTRAINT alert_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: anr_groups anr_groups_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anr_groups
    ADD CONSTRAINT anr_groups_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


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
-- Name: build_mappings build_mappings_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_mappings
    ADD CONSTRAINT build_mappings_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


--
-- Name: build_sizes build_sizes_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_sizes
    ADD CONSTRAINT build_sizes_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


--
-- Name: event_reqs event_reqs_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reqs
    ADD CONSTRAINT event_reqs_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT team_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: unhandled_exception_groups unhandled_exception_groups_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unhandled_exception_groups
    ADD CONSTRAINT unhandled_exception_groups_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


--
-- Dbmate schema migrations
--

INSERT INTO dbmate.schema_migrations (version) VALUES
    ('20231117010311'),
    ('20231117010312'),
    ('20231117010526'),
    ('20231117011737'),
    ('20231117012011'),
    ('20231117012219'),
    ('20231117012557'),
    ('20231117012726'),
    ('20231122211412'),
    ('20231228033348'),
    ('20231228044339'),
    ('20240311054505'),
    ('20240404122712'),
    ('20240502060117');
