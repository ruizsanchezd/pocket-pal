-- Add explicit restrictive RLS policies for user_roles table
-- These prevent users from modifying their own roles (only system/trigger can do that)

-- Policy to explicitly prevent INSERT by users
CREATE POLICY "Users cannot insert roles" ON public.user_roles
  FOR INSERT 
  WITH CHECK (false);

-- Policy to explicitly prevent UPDATE by users
CREATE POLICY "Users cannot update roles" ON public.user_roles
  FOR UPDATE 
  USING (false) 
  WITH CHECK (false);

-- Policy to explicitly prevent DELETE by users
CREATE POLICY "Users cannot delete roles" ON public.user_roles
  FOR DELETE 
  USING (false);