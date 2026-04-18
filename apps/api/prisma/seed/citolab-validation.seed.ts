import { PrismaClient } from '@prisma/client';

const CITOLAB_TENANT_ID = 'd8d330f3-075d-41a5-9e6b-783d26f2070d';

export async function seedCitolabValidation(prisma: PrismaClient) {
  const tenantId = CITOLAB_TENANT_ID;

  // ─── 1. Procedencias sensibles ────────────────────────────────────────
  const sensitiveOrigins = [
    { nameMatch: 'HTSP' },
    { nameMatch: 'HTSCEM' },
    { nameMatch: 'FUNDACION SAN CRISTOBAL' },
    { nameMatch: 'MEGASALUD' },
    { nameMatch: 'POLICENTER' },
    { nameMatch: 'HOSPITAL DEL PROFESOR' },
  ];
  for (const o of sensitiveOrigins) {
    const seedId = `seed-sensitive-${tenantId}-${o.nameMatch.replace(/\s+/g, '-').toLowerCase()}`;
    await prisma.labSensitiveOrigin.upsert({
      where: { id: seedId },
      create: {
        id: seedId,
        tenantId,
        nameMatch: o.nameMatch,
        rule: 'MUESTRA_TEXTUAL_EXACTA',
        isActive: true,
      },
      update: {},
    });
  }

  // ─── 2. Lexicón de criticidad ──────────────────────────────────────────
  type LexCat = 'MALIGNIDAD' | 'INVASION' | 'IN_SITU' | 'SOSPECHA'
    | 'INFECCION_CRITICA' | 'HEMATOLOGIA_AGRESIVA' | 'TRASPLANTE_VASCULITIS' | 'NEGACION';

  const lexicon: Array<{ category: LexCat; pattern: string; isRegex?: boolean; weight?: number }> = [
    // MALIGNIDAD
    { category: 'MALIGNIDAD', pattern: 'carcinoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'adenocarcinoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'sarcoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'linfoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'leucemia', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'melanoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'mieloma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'mesotelioma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'blastoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'glioma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'seminoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'coriocarcinoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'neoplasia maligna', weight: 3 },
    // INVASION
    { category: 'INVASION', pattern: 'infiltrante', weight: 2 },
    { category: 'INVASION', pattern: 'invasor', weight: 2 },
    { category: 'INVASION', pattern: 'metástasis', weight: 3 },
    { category: 'INVASION', pattern: 'metastásico', weight: 3 },
    { category: 'INVASION', pattern: 'margen (positivo|comprometido|afectado)', isRegex: true, weight: 3 },
    // IN_SITU
    { category: 'IN_SITU', pattern: 'in situ', weight: 2 },
    { category: 'IN_SITU', pattern: 'CIS', weight: 2 },
    { category: 'IN_SITU', pattern: 'DCIS', weight: 2 },
    { category: 'IN_SITU', pattern: 'HSIL', weight: 3 },
    { category: 'IN_SITU', pattern: 'AIS', weight: 2 },
    { category: 'IN_SITU', pattern: 'displasia (severa|alto grado|grado alto)', isRegex: true, weight: 2 },
    // SOSPECHA
    { category: 'SOSPECHA', pattern: 'sospechoso de malignidad', weight: 2 },
    { category: 'SOSPECHA', pattern: 'compatible con malignidad', weight: 2 },
    { category: 'SOSPECHA', pattern: 'ASC-H', weight: 2 },
    { category: 'SOSPECHA', pattern: 'AGC', weight: 2 },
    { category: 'SOSPECHA', pattern: 'no se puede descartar malignidad', weight: 2 },
    // INFECCION_CRITICA
    { category: 'INFECCION_CRITICA', pattern: 'tuberculosis', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'BAAR', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Pneumocystis', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Aspergillus', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Mucor', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Cryptococcus', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'citomegalovirus', weight: 2 },
    { category: 'INFECCION_CRITICA', pattern: 'granuloma caseificante', weight: 3 },
    // HEMATOLOGIA_AGRESIVA
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'blastos', weight: 3 },
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'Burkitt', weight: 3 },
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'LDGCB', weight: 3 },
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'linfoblástico', weight: 3 },
    // TRASPLANTE_VASCULITIS
    { category: 'TRASPLANTE_VASCULITIS', pattern: 'rechazo (agudo|activo|mediado)', isRegex: true, weight: 3 },
    { category: 'TRASPLANTE_VASCULITIS', pattern: 'vasculitis (activa|necrotizante)', isRegex: true, weight: 3 },
    { category: 'TRASPLANTE_VASCULITIS', pattern: 'glomerulonefritis rápidamente progresiva', weight: 3 },
    // NEGACION
    { category: 'NEGACION', pattern: 'no se observa', weight: 1 },
    { category: 'NEGACION', pattern: 'sin evidencia de', weight: 1 },
    { category: 'NEGACION', pattern: 'negativo para', weight: 1 },
    { category: 'NEGACION', pattern: 'descarta', weight: 1 },
    { category: 'NEGACION', pattern: 'ausente', weight: 1 },
    { category: 'NEGACION', pattern: 'ausencia de', weight: 1 },
    { category: 'NEGACION', pattern: 'libre de', weight: 1 },
    { category: 'NEGACION', pattern: 'no se identifica', weight: 1 },
    { category: 'NEGACION', pattern: 'compatible con proceso benigno', weight: 1 },
    { category: 'NEGACION', pattern: 'NILM', weight: 1 },
  ];
  for (const entry of lexicon) {
    const seedId = `seed-lex-${tenantId}-${entry.category}-${entry.pattern}`.replace(/[^a-z0-9-]/gi, '_');
    await prisma.labCriticalityLexicon.upsert({
      where: { id: seedId },
      create: {
        id: seedId,
        tenantId,
        category: entry.category as any,
        pattern: entry.pattern,
        isRegex: entry.isRegex ?? false,
        weight: entry.weight ?? 1,
        locale: 'es-CL',
        isActive: true,
      },
      update: {},
    });
  }

  // ─── 3. Reglas de lateralidad ─────────────────────────────────────────
  type LatReq = 'REQUIRED' | 'NOT_APPLICABLE' | 'CONTEXTUAL';
  const laterality: Array<{ organPattern: string; requirement: LatReq }> = [
    { organPattern: 'mama', requirement: 'REQUIRED' },
    { organPattern: 'ovario', requirement: 'REQUIRED' },
    { organPattern: 'trompa', requirement: 'REQUIRED' },
    { organPattern: 'testículo', requirement: 'REQUIRED' },
    { organPattern: 'testiculo', requirement: 'REQUIRED' },
    { organPattern: 'epidídimo', requirement: 'REQUIRED' },
    { organPattern: 'epididimo', requirement: 'REQUIRED' },
    { organPattern: 'riñón', requirement: 'REQUIRED' },
    { organPattern: 'rinon', requirement: 'REQUIRED' },
    { organPattern: 'uréter', requirement: 'REQUIRED' },
    { organPattern: 'ureter', requirement: 'REQUIRED' },
    { organPattern: 'suprarrenal', requirement: 'REQUIRED' },
    { organPattern: 'pulmón', requirement: 'REQUIRED' },
    { organPattern: 'pulmon', requirement: 'REQUIRED' },
    { organPattern: 'bronquio', requirement: 'REQUIRED' },
    { organPattern: 'amígdala', requirement: 'REQUIRED' },
    { organPattern: 'amigdala', requirement: 'REQUIRED' },
    { organPattern: 'parótida', requirement: 'REQUIRED' },
    { organPattern: 'parotida', requirement: 'REQUIRED' },
    { organPattern: 'submaxilar', requirement: 'REQUIRED' },
    { organPattern: 'tiroides', requirement: 'REQUIRED' },
    { organPattern: 'paratiroides', requirement: 'REQUIRED' },
    { organPattern: 'globo ocular', requirement: 'REQUIRED' },
    { organPattern: 'oído', requirement: 'REQUIRED' },
    { organPattern: 'oido', requirement: 'REQUIRED' },
    { organPattern: 'extremidad', requirement: 'REQUIRED' },
    { organPattern: 'miembro superior', requirement: 'REQUIRED' },
    { organPattern: 'miembro inferior', requirement: 'REQUIRED' },
    { organPattern: 'ganglio axilar', requirement: 'REQUIRED' },
    { organPattern: 'ganglio inguinal', requirement: 'REQUIRED' },
    { organPattern: 'ganglio supraclavicular', requirement: 'REQUIRED' },
    { organPattern: 'pleura', requirement: 'REQUIRED' },
    { organPattern: 'médula ósea', requirement: 'REQUIRED' },
    { organPattern: 'medula osea', requirement: 'REQUIRED' },
    { organPattern: 'útero', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'utero', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'cuello uterino', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'endometrio', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vagina', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'próstata', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'prostata', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'pene', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'estómago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'estomago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'esófago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'esofago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'colon', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'recto', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'apéndice', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'apendice', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vesícula', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vesicula', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'páncreas', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'pancreas', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'bazo', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vejiga', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'uretra', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'laringe', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'tráquea', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'traquea', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'ganglio cervical', requirement: 'CONTEXTUAL' },
    { organPattern: 'ganglio mediastínico', requirement: 'CONTEXTUAL' },
    { organPattern: 'hígado', requirement: 'CONTEXTUAL' },
    { organPattern: 'higado', requirement: 'CONTEXTUAL' },
    { organPattern: 'piel', requirement: 'CONTEXTUAL' },
    { organPattern: 'vulva', requirement: 'CONTEXTUAL' },
  ];
  for (const rule of laterality) {
    await prisma.labLateralityOrganRule.upsert({
      where: {
        tenantId_organPattern: {
          tenantId,
          organPattern: rule.organPattern,
        },
      },
      create: {
        tenantId,
        organPattern: rule.organPattern,
        requirement: rule.requirement as any,
      },
      update: { requirement: rule.requirement as any },
    });
  }

  // ─── 4. Ruleset default ────────────────────────────────────────────────
  await prisma.labValidationRuleset.upsert({
    where: { tenantId },
    create: {
      tenantId,
      gateEnabled: false,
      thresholdCritical: 3,
      thresholdMediumConfidence: 0.70,
      autoApproveWithExplicitFlag: true,
      concordanceEnsembleOnMalign: true,
      visionVlmEnabled: true,
      pdfFinalVlmEnabled: false,
      agentsEnabled: {
        IDENTITY: true,
        ORIGIN: true,
        SAMPLE: true,
        CONCORDANCE: true,
        CRITICALITY: true,
        TRACEABILITY: true,
        VISION_REQUEST: true,
        VISION_ENCAPSULATION_MACRO: true,
        PDF_FINAL: true,
      },
    },
    update: {},
  });

  // ─── 5. Grupos de aprobadores ──────────────────────────────────────────
  const criticalsGroupId = `approval-group-${tenantId}-critical`;
  await prisma.approvalGroup.upsert({
    where: { tenantId_slug: { tenantId, slug: 'citolab-criticals' } },
    create: {
      id: criticalsGroupId,
      tenantId,
      slug: 'citolab-criticals',
      name: 'Críticos — Citolab',
      description: 'Aprobadores para validaciones críticas fallidas (malignidad, IHQ, cruce de casos)',
      reason: 'CRITICAL_VALIDATION_FAILED',
      minApprovers: 2,
      excludeOriginalActor: true,
      slaHours: 72,
      isActive: true,
    },
    update: {},
  });

  const qualityGroupId = `approval-group-${tenantId}-quality`;
  await prisma.approvalGroup.upsert({
    where: { tenantId_slug: { tenantId, slug: 'citolab-quality' } },
    create: {
      id: qualityGroupId,
      tenantId,
      slug: 'citolab-quality',
      name: 'Calidad — Citolab',
      description: 'Aprobadores de validaciones no críticas fallidas',
      reason: 'NON_CRITICAL_VALIDATION_FAILED',
      minApprovers: 1,
      excludeOriginalActor: true,
      slaHours: 48,
      isActive: true,
    },
    update: {},
  });

  // ─── 6. Destinatarios de alertas por defecto ──────────────────────────
  const recipients = [
    { scope: 'ORIGINAL_ACTOR' as const, reason: null, permissionKey: null, channels: ['IN_APP', 'EMAIL'] },
    { scope: 'PERMISSION' as const, reason: null, permissionKey: 'lab-reports:validate', channels: ['IN_APP', 'EMAIL'] },
    { scope: 'PERMISSION' as const, reason: 'CRITICAL_VALIDATION_FAILED' as const, permissionKey: 'operations:manage', channels: ['IN_APP', 'EMAIL'] },
    { scope: 'PERMISSION' as const, reason: 'CRITICAL_VALIDATION_FAILED' as const, permissionKey: 'tenant:manage', channels: ['EMAIL'] },
  ];
  for (const r of recipients) {
    const seedId = `seed-recip-${tenantId}-${r.scope}-${r.permissionKey ?? 'any'}-${r.reason ?? 'any'}`;
    await prisma.approvalAlertRecipient.upsert({
      where: { id: seedId },
      create: {
        id: seedId,
        tenantId,
        scope: r.scope,
        reason: r.reason as any,
        permissionKey: r.permissionKey,
        channels: r.channels as any,
      },
      update: {},
    });
  }

  return {
    sensitiveOrigins: sensitiveOrigins.length,
    lexiconEntries: lexicon.length,
    lateralityRules: laterality.length,
    approvalGroups: 2,
    alertRecipients: recipients.length,
  };
}
