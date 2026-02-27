-- Course Modules
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Course Lessons
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  video_url TEXT, -- YouTube link
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lesson Materials
CREATE TABLE IF NOT EXISTS public.lesson_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has access to a product via payment
CREATE OR REPLACE FUNCTION public.has_product_access(_user_email TEXT, _product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE LOWER(payer_email) = LOWER(_user_email)
      AND product_id = _product_id
      AND status = 'approved'
  )
$$;

-- Policies for modules
CREATE POLICY "Team members can manage modules"
ON public.course_modules FOR ALL
TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Members can view modules they paid for"
ON public.course_modules FOR SELECT
TO authenticated
USING (
  public.has_product_access(auth.jwt() ->> 'email', product_id)
);

-- Policies for lessons
CREATE POLICY "Team members can manage lessons"
ON public.course_lessons FOR ALL
TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Members can view lessons they paid for"
ON public.course_lessons FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_modules
    WHERE id = module_id
    AND public.has_product_access(auth.jwt() ->> 'email', product_id)
  )
);

-- Policies for materials
CREATE POLICY "Team members can manage materials"
ON public.lesson_materials FOR ALL
TO authenticated
USING (public.is_team_member(auth.uid()));

CREATE POLICY "Members can view materials they paid for"
ON public.lesson_materials FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_lessons
    JOIN public.course_modules ON course_modules.id = course_lessons.module_id
    WHERE course_lessons.id = lesson_id
    AND public.has_product_access(auth.jwt() ->> 'email', product_id)
  )
);

-- Updates trigger for updated_at
CREATE TRIGGER update_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_lessons_updated_at
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
