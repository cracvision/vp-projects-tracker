-- Fix security warnings by setting search_path on functions

-- Fix update_task_rollup_on_entry_insert function
CREATE OR REPLACE FUNCTION update_task_rollup_on_entry_insert()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_task_rollup_on_entry_delete function
CREATE OR REPLACE FUNCTION update_task_rollup_on_entry_delete()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;