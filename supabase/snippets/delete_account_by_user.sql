-- Function to allow users to delete their own account and all associated data
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  -- Delete from session_member
  delete from public.session_member where user_id = current_user_id;

  -- Delete from profiles
  delete from public.profiles where id = current_user_id;

  -- Delete from auth.users
  delete from auth.users where id = current_user_id;
end;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_account() TO authenticated;