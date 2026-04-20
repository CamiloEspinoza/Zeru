-- Migration: F0 review fixes
--
-- Fixes para los hallazgos de revisión post-F0:
--   #6  — quita la FK polimórfica `approval_req_validation_fk` (rompía el modelo polimórfico)
--   #7  — al quitar la FK, deja de bloquear la cascada de borrado de LabDiagnosticReport
--   #8  — trigger SoD ahora valida que el ApprovalRequest exista (NOT FOUND => raise)
--   #12 — los triggers usan DROP IF EXISTS para ser idempotentes en re-aplicaciones
--   #13 — unique parcial en approval_requests para impedir múltiples PENDING simultáneos por subject
--   #14 — FK explícita desde lab_validation_audit_records.validation_id → lab_report_validations.id (Restrict)

-- ────────────────────────────────────────────────────────────────────────────
-- #6 / #7 — Eliminar FK polimórfica `approval_req_validation_fk`
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "public"."approval_requests"
  DROP CONSTRAINT IF EXISTS "approval_req_validation_fk";

-- ────────────────────────────────────────────────────────────────────────────
-- #14 — Agregar FK lab_validation_audit_records.validation_id (Restrict)
-- ────────────────────────────────────────────────────────────────────────────
-- Restrict: la auditoría debe sobrevivir a la validación; el borrado explícito
-- requiere borrar primero el audit row.
ALTER TABLE "mod_lab"."lab_validation_audit_records"
  ADD CONSTRAINT "lab_validation_audit_records_validationId_fkey"
  FOREIGN KEY ("validationId")
  REFERENCES "mod_lab"."lab_report_validations"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- #13 — Unique parcial: una sola request PENDING por (tenant, subjectType, subjectId)
-- ────────────────────────────────────────────────────────────────────────────
-- Prisma no soporta partial indexes nativamente; aplicamos a mano.
DROP INDEX IF EXISTS "public"."approval_requests_pending_subject_unique";
CREATE UNIQUE INDEX "approval_requests_pending_subject_unique"
  ON "public"."approval_requests" ("tenantId", "subjectType", "subjectId")
  WHERE status = 'PENDING';

-- ────────────────────────────────────────────────────────────────────────────
-- #12 — Recrear triggers de aprobación con DROP IF EXISTS (idempotente)
-- #8  — Trigger SoD ahora rechaza el INSERT si el ApprovalRequest no existe
-- ────────────────────────────────────────────────────────────────────────────

-- Función inmutabilidad: re-create idempotente (ya estaba con OR REPLACE en F0)
CREATE OR REPLACE FUNCTION public.fn_approval_decisions_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'approval_decisions are immutable: UPDATE is not allowed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'approval_decisions are immutable: DELETE is not allowed';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_decisions_immutable ON public.approval_decisions;
CREATE TRIGGER approval_decisions_immutable
  BEFORE UPDATE OR DELETE ON public.approval_decisions
  FOR EACH ROW EXECUTE FUNCTION public.fn_approval_decisions_immutable();

-- Función SoD: rechaza si el solicitante original es quien decide.
-- AHORA: si el ApprovalRequest no existe (FK debería prevenirlo, pero protegemos
-- contra cualquier path) levantamos excepción explícita.
CREATE OR REPLACE FUNCTION public.fn_approval_decisions_sod()
RETURNS TRIGGER AS $$
DECLARE
  v_original_actor_id TEXT;
  v_exclude_original  BOOLEAN;
BEGIN
  SELECT ar."originalActorId", g."excludeOriginalActor"
    INTO v_original_actor_id, v_exclude_original
    FROM public.approval_requests ar
    JOIN public.approval_groups g ON g.id = ar."groupId"
   WHERE ar.id = NEW."requestId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval_decisions SoD check failed: request % not found', NEW."requestId";
  END IF;

  IF v_exclude_original AND v_original_actor_id IS NOT NULL
     AND v_original_actor_id = NEW."decidedById" THEN
    RAISE EXCEPTION 'SoD violation: original actor % cannot approve their own request %',
      NEW."decidedById", NEW."requestId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_decisions_sod ON public.approval_decisions;
CREATE TRIGGER approval_decisions_sod
  BEFORE INSERT ON public.approval_decisions
  FOR EACH ROW EXECUTE FUNCTION public.fn_approval_decisions_sod();
