-- UPDATE trigger: recalcular rollups cuando se edita una entrada
CREATE OR REPLACE FUNCTION public.update_task_rollup_on_entry_update()
RETURNS TRIGGER AS $$
DECLARE
  old_task UUID := OLD.task_id;
  new_task UUID := NEW.task_id;
  old_hours NUMERIC := COALESCE(OLD.hours, 0);
  new_hours NUMERIC := COALESCE(NEW.hours, 0);
BEGIN
  -- Si la tarea cambió: revertir en la anterior y aplicar en la nueva
  IF old_task IS DISTINCT FROM new_task THEN
    IF old_task IS NOT NULL THEN
      UPDATE public.tasks
      SET actual_hours = GREATEST(0, actual_hours - old_hours),
          progress = LEAST(100, ROUND(GREATEST(0, actual_hours - old_hours) / NULLIF(estimated_hours_max,0) * 100)),
          updated_at = NOW()
      WHERE id = old_task;
    END IF;

    IF new_task IS NOT NULL THEN
      UPDATE public.tasks
      SET actual_hours = actual_hours + new_hours,
          progress = LEAST(100, ROUND((actual_hours + new_hours) / NULLIF(estimated_hours_max,0) * 100)),
          updated_at = NOW()
      WHERE id = new_task;
    END IF;

  -- Misma tarea pero cambió horas: aplicar delta
  ELSIF old_hours IS DISTINCT FROM new_hours AND new_task IS NOT NULL THEN
    UPDATE public.tasks
    SET actual_hours = GREATEST(0, actual_hours - old_hours + new_hours),
        progress = LEAST(100, ROUND(GREATEST(0, actual_hours - old_hours + new_hours) / NULLIF(estimated_hours_max,0) * 100)),
        updated_at = NOW()
    WHERE id = new_task;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_task_rollup_on_update ON public.daily_entries;

CREATE TRIGGER trigger_update_task_rollup_on_update
AFTER UPDATE ON public.daily_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_task_rollup_on_entry_update();