-- Enable Supabase Realtime for tables that need live updates
-- This must be run against the database for postgres_changes subscriptions to work

ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.summaries;
