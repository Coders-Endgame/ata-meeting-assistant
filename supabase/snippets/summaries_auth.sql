-- Enable RLS on the table (ensure it is enabled)
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Create a catch-all policy that allows ALL operations (SELECT, INSERT, UPDATE, DELETE) for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON public.summaries
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
