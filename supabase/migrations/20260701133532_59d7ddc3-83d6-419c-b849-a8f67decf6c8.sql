
-- 1) Auto-grant admin to the site owner email on verified signup / verification
CREATE OR REPLACE FUNCTION public.grant_owner_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'r3zaassassin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin_role();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_owner
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_owner_admin_role();

-- Backfill if the user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = 'r3zaassassin@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Admin CRUD policies
CREATE POLICY "Admins update all documents" ON public.documents
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete all documents" ON public.documents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete all tickets" ON public.tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete all messages" ON public.ticket_messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 3) Admin-only RPC: list all accounts
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  roles text[],
  documents_count bigint,
  tickets_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT u.id,
         u.email::text,
         u.created_at,
         u.last_sign_in_at,
         u.email_confirmed_at,
         COALESCE(ARRAY_AGG(DISTINCT r.role::text) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::text[]),
         (SELECT COUNT(*) FROM public.documents d WHERE d.owner_id = u.id),
         (SELECT COUNT(*) FROM public.tickets t WHERE t.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  GROUP BY u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 4) Admin-only RPC: delete an account entirely
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 5) Admin-only RPC: list all documents with owner email
CREATE OR REPLACE FUNCTION public.admin_list_documents()
RETURNS TABLE (
  id uuid,
  title text,
  owner_id uuid,
  owner_email text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT d.id, d.title, d.owner_id, u.email::text, d.created_at, d.updated_at
  FROM public.documents d
  LEFT JOIN auth.users u ON u.id = d.owner_id
  ORDER BY d.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_documents() TO authenticated;

-- 6) Changelog entry
INSERT INTO public.changelog (version, title, body)
VALUES (
  '1.5.0',
  'گسترش پنل مدیریت',
  E'پنل مدیریت کامل‌تر شد:\n• دسترسی مدیر اصلی سایت (r3zaassassin@gmail.com) به صورت خودکار پس از تأیید ایمیل فعال می‌شود.\n• مدیر می‌تواند لیست کامل حساب‌ها را همراه با تاریخ ثبت‌نام، آخرین ورود، تعداد اسناد و تیکت‌ها ببیند و حساب‌ها را حذف کند.\n• مدیر می‌تواند همه‌ی اسناد ساخته شده توسط کاربران را به همراه تاریخ مشاهده و در صورت لزوم حذف کند.\n• حذف کامل تیکت‌ها توسط مدیر پشتیبانی شد.'
);
