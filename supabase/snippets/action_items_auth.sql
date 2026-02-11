-- Enable RLS on the table (ensure it is enabled)
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- Create a catch-all policy that allows ALL operations (SELECT, INSERT, UPDATE, DELETE) for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON public.action_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
