-- Rewrite update_own_profile with full diagnostic info
-- Returns auth.uid(), rows affected, and profile data
-- to identify exactly why the update is not persisting

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
  _rows_affected INT;
  _profile JSON;
  _profile_exists BOOLEAN;
BEGIN
  _user_id := auth.uid();

  -- Check if profile exists for this user
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user_id) INTO _profile_exists;

  -- If no auth or no profile, return debug info instead of failing silently
  IF _user_id IS NULL THEN
    RETURN json_build_object(
      'error', 'auth.uid() returned NULL',
      'auth_uid', NULL,
      'profile_exists', false,
      'rows_affected', 0
    );
  END IF;

  -- Do the update
  UPDATE public.profiles
  SET
    display_name = CASE WHEN _set_display_name THEN _display_name ELSE display_name END,
    avatar_url = CASE WHEN _set_avatar_url THEN _avatar_url ELSE avatar_url END,
    updated_at = NOW()
  WHERE id = _user_id;

  GET DIAGNOSTICS _rows_affected = ROW_COUNT;

  -- Get the profile after update
  SELECT row_to_json(p) INTO _profile
  FROM public.profiles p
  WHERE p.id = _user_id;

  RETURN json_build_object(
    'auth_uid', _user_id,
    'profile_exists', _profile_exists,
    'rows_affected', _rows_affected,
    'profile', _profile
  );
END;
$$;
