-- Migration: drop orphan approval functions
--
-- La migración F0 inicial creó funciones con nombres
-- `forbid_approval_decision_mutation` y `enforce_sod_on_decision`. La revisión
-- de F0 (commit 9dfad0e) recreó los triggers usando nombres `fn_*` pero dejó
-- las funciones originales en la base. Las eliminamos para evitar confusión
-- en `prisma db pull` y debugging futuro.

DROP FUNCTION IF EXISTS public.forbid_approval_decision_mutation();
DROP FUNCTION IF EXISTS public.enforce_sod_on_decision();
