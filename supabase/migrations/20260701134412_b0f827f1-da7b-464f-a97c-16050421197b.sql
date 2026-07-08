
-- Admin activity log
CREATE TABLE public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.admin_activity_log TO service_role;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read activity log" ON public.admin_activity_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "system inserts activity" ON public.admin_activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX admin_activity_log_created_idx ON public.admin_activity_log(created_at DESC);

-- Auto-log document create/delete
CREATE OR REPLACE FUNCTION public.log_document_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_uid uuid := auth.uid();
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_activity_log(actor_id, actor_email, action, entity_type, entity_id, metadata)
    VALUES (v_uid, v_email, 'create', 'document', NEW.id, jsonb_build_object('title', NEW.title));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_activity_log(actor_id, actor_email, action, entity_type, entity_id, metadata)
    VALUES (v_uid, v_email, 'delete', 'document', OLD.id, jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_document_activity ON public.documents;
CREATE TRIGGER trg_log_document_activity
AFTER INSERT OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_document_activity();

-- Log user deletes (called via admin_delete_user)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_target_email text;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT email INTO v_target_email FROM auth.users WHERE id = _user_id;
  INSERT INTO public.admin_activity_log(actor_id, actor_email, action, entity_type, entity_id, metadata)
  VALUES (v_uid, v_email, 'delete', 'user', _user_id, jsonb_build_object('email', v_target_email));
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- Admin list activity RPC
CREATE OR REPLACE FUNCTION public.admin_list_activity(_limit int DEFAULT 200)
RETURNS TABLE(id uuid, actor_id uuid, actor_email text, action text, entity_type text, entity_id uuid, metadata jsonb, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT a.id, a.actor_id, a.actor_email, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at
  FROM public.admin_activity_log a
  ORDER BY a.created_at DESC
  LIMIT _limit;
END;
$$;

-- Add changelog v1.6.0
INSERT INTO public.changelog (version, title, body) VALUES (
  '1.6.0',
  'بهبود مداد + لاگ مدیریت + نمایش سازنده اسناد',
  E'• اصلاح حالت مداد: نشانگر موس شکل مداد گرفت و کشیدن خطوط پایدار شد.\n• دکمه فعال‌سازی مداد از منوی تنظیمات قلم جدا شد تا با یک کلیک فعال شود.\n• لاگ فعالیت مدیریت (ساخت/حذف اسناد و حذف حساب‌ها) با تاریخ و ایمیل اقدام‌کننده اضافه شد.\n• در پنل مدیریت، ستون مالک سند اگر خود شما باشید «YOU» نمایش داده می‌شود، در غیر این صورت ایمیل مالک.'
);
