-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sow TEXT,
  due_date DATE,
  hourly_rate NUMERIC DEFAULT 65,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = owner_uid);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = owner_uid);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = owner_uid);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = owner_uid);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  estimated_hours_min NUMERIC,
  estimated_hours_max NUMERIC NOT NULL,
  actual_hours NUMERIC DEFAULT 0,
  progress NUMERIC DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
CREATE POLICY "Users can view tasks from their own projects"
  ON public.tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can create tasks in their own projects"
  ON public.tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can update tasks in their own projects"
  ON public.tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can delete tasks from their own projects"
  ON public.tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = tasks.project_id
    AND projects.owner_uid = auth.uid()
  ));

-- Create daily_entries table
CREATE TABLE public.daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  author_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_iso DATE NOT NULL,
  hours NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_entries
CREATE POLICY "Users can view daily entries from their own projects"
  ON public.daily_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = daily_entries.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can create daily entries in their own projects"
  ON public.daily_entries FOR INSERT
  WITH CHECK (
    auth.uid() = author_uid
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = daily_entries.project_id
      AND projects.owner_uid = auth.uid()
    )
  );

CREATE POLICY "Users can update daily entries in their own projects"
  ON public.daily_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = daily_entries.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can delete daily entries from their own projects"
  ON public.daily_entries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = daily_entries.project_id
    AND projects.owner_uid = auth.uid()
  ));

-- Create reports table (optional for storing generated reports)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'status')),
  date_iso DATE,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for reports
CREATE POLICY "Users can view reports from their own projects"
  ON public.reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = reports.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can create reports in their own projects"
  ON public.reports FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = reports.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can update reports in their own projects"
  ON public.reports FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = reports.project_id
    AND projects.owner_uid = auth.uid()
  ));

CREATE POLICY "Users can delete reports from their own projects"
  ON public.reports FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = reports.project_id
    AND projects.owner_uid = auth.uid()
  ));

-- Trigger function to update task rollups when daily entry is added
CREATE OR REPLACE FUNCTION update_task_rollup_on_entry_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the task's actual_hours and progress
  IF NEW.task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET 
      actual_hours = actual_hours + NEW.hours,
      progress = LEAST(100, ROUND((actual_hours + NEW.hours) / estimated_hours_max * 100)),
      updated_at = NOW()
    WHERE id = NEW.task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_task_rollup_on_insert
  AFTER INSERT ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_task_rollup_on_entry_insert();

-- Trigger function to update task rollups when daily entry is deleted
CREATE OR REPLACE FUNCTION update_task_rollup_on_entry_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the task's actual_hours and progress
  IF OLD.task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET 
      actual_hours = GREATEST(0, actual_hours - OLD.hours),
      progress = LEAST(100, ROUND(GREATEST(0, actual_hours - OLD.hours) / estimated_hours_max * 100)),
      updated_at = NOW()
    WHERE id = OLD.task_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_task_rollup_on_delete
  AFTER DELETE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_task_rollup_on_entry_delete();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_projects_owner ON public.projects(owner_uid);
CREATE INDEX idx_projects_archived ON public.projects(archived);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_daily_entries_project ON public.daily_entries(project_id);
CREATE INDEX idx_daily_entries_task ON public.daily_entries(task_id);
CREATE INDEX idx_daily_entries_date ON public.daily_entries(date_iso);
CREATE INDEX idx_reports_project ON public.reports(project_id);