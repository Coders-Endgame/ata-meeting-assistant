-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_ref text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  source_type text NOT NULL,
  processing_status text,
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.action_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  description text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  CONSTRAINT action_items_pkey PRIMARY KEY (id),
  CONSTRAINT action_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.action_item_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  action_item_id uuid NOT NULL,
  assigned_to text,
  CONSTRAINT action_item_assignees_pkey PRIMARY KEY (id),
  CONSTRAINT action_item_assignees_action_item_id_fkey FOREIGN KEY (action_item_id) REFERENCES public.action_items(id)
);
CREATE TABLE public.bots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  session uuid NOT NULL,
  started_at timestamp with time zone,
  terminated_at timestamp with time zone,
  CONSTRAINT bots_pkey PRIMARY KEY (id),
  CONSTRAINT bots_session_fkey FOREIGN KEY (session) REFERENCES public.sessions(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text,
  last_name text,
  email text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.session_member (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT session_member_pkey PRIMARY KEY (id),
  CONSTRAINT session_member_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT session_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  CONSTRAINT summaries_pkey PRIMARY KEY (id),
  CONSTRAINT summaries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  speaker text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  transcript text NOT NULL,
  session_id uuid NOT NULL,
  CONSTRAINT transcripts_pkey PRIMARY KEY (id),
  CONSTRAINT transcripts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);