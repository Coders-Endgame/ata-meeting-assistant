-- Create a new private bucket for audio uploads
insert into storage.buckets (id, name, public)
values ('audio-uploads', 'audio-uploads', false);

-- Set up security policies for the 'audio-uploads' bucket

-- 1. Allow authenticated users to upload files to their own folder (or any folder for now, but best practice is user specific)
-- We'll allow uploading to any path for simplicity as per requirements, or restrict to a user folder if possible.
-- "user uploads audio file" -> usually implies they own it.
-- Let's allow authenticated users to INSERT files.
create policy "Authenticated users can upload audio files"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'audio-uploads' );

-- 2. Allow authenticated users to VIEW (select) files
-- This allows any authenticated user to listen to the audio session if they have access to the link.
-- Ideally we should check if they are a member of the session, but storage policies don't easily join with public tables.
-- For now, we'll allow authenticated users to read files in this bucket.
create policy "Authenticated users can select audio files"
on storage.objects for select
to authenticated
using ( bucket_id = 'audio-uploads' );

-- 3. Allow authenticated users to UPDATE/DELETE their own files?
-- Optional, maybe not needed for this task.
