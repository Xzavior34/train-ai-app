-- Train AI 2.0 - Transactional Email Organization Resolution RPC
CREATE OR REPLACE FUNCTION get_user_org_name(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_name text;
BEGIN
  SELECT o.name INTO v_org_name
  FROM auth.users u
  JOIN user_profiles p ON p.id = u.id
  JOIN organizations o ON o.id = p.organization_id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_org_name IS NULL THEN
    SELECT o.name INTO v_org_name
    FROM user_invitations i
    JOIN organizations o ON o.id = i.organization_id
    WHERE lower(i.email) = lower(p_email)
    ORDER BY i.created_at DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_org_name, 'Train AI');
END;
$$;
