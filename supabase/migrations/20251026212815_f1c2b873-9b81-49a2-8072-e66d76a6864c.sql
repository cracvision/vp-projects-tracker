-- 1) Al insertar una tarea sin display_order, ponla al final del proyecto
CREATE OR REPLACE FUNCTION public.set_task_display_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_order IS NULL THEN
    SELECT COALESCE(MAX(t.display_order), -1) + 1
      INTO NEW.display_order
      FROM public.tasks t
     WHERE t.project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_task_display_order ON public.tasks;
CREATE TRIGGER trg_set_task_display_order
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_display_order();

-- 2) Si cambia estimated_hours_max o actual_hours en tasks, recalcula progress
CREATE OR REPLACE FUNCTION public.recompute_task_progress_on_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.progress := LEAST(
    100,
    ROUND(
      COALESCE(NULLIF(NEW.actual_hours, 0), 0) / NULLIF(NEW.estimated_hours_max, 0) * 100
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_recompute_task_progress_on_update ON public.tasks;
CREATE TRIGGER trg_recompute_task_progress_on_update
BEFORE UPDATE OF estimated_hours_max, actual_hours ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.recompute_task_progress_on_update();