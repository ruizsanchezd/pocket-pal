-- Fix: profile row may not exist for some users (trigger failure on signup)
-- Use UPSERT to create the profile if missing, then update it

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
  _user_id := auth.uid();

  IF _user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Upsert: create profile if it doesn't exist, update if it does
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    _user_id,
    CASE WHEN _set_display_name THEN _display_name ELSE NULL END,
    CASE WHEN _set_avatar_url THEN _avatar_url ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE WHEN _set_display_name THEN _display_name ELSE profiles.display_name END,
    avatar_url = CASE WHEN _set_avatar_url THEN _avatar_url ELSE profiles.avatar_url END,
    updated_at = NOW();

  -- Return the profile
  SELECT row_to_json(p) INTO _result
  FROM public.profiles p
  WHERE p.id = _user_id;

  RETURN json_build_object('profile', _result);
END;
$$;
