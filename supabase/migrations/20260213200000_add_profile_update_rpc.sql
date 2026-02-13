-- RPC function to update own profile, bypasses RLS issues
-- Uses SECURITY DEFINER to run with elevated permissions
-- but validates auth.uid() internally for safety

CREATE OR REPLACE FUNCTION public.update_own_profile(
  _display_name TEXT DEFAULT NULL,
  _avatar_url TEXT DEFAULT NULL,
  _set_display_name BOOLEAN DEFAULT FALSE,
  _set_avatar_url BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _result JSON;
BEGIN
  -- Get the authenticated user's ID
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update only the fields that were explicitly requested
  UPDATE public.profiles
  SET
    display_name = CASE WHEN _set_display_name THEN _display_name ELSE display_name END,
    avatar_url = CASE WHEN _set_avatar_url THEN _avatar_url ELSE avatar_url END,
    updated_at = NOW()
  WHERE id = _user_id;

  -- Return the updated profile
  SELECT row_to_json(p) INTO _result
  FROM public.profiles p
  WHERE p.id = _user_id;

  RETURN _result;
END;
$$;
