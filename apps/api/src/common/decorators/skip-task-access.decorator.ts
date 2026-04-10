import { SetMetadata } from '@nestjs/common';

export const SKIP_TASK_ACCESS_GUARD_KEY = 'skip_task_access_guard';

/**
 * Marks a route to skip the TaskAccessGuard. Use this for cross-project
 * endpoints (e.g. GET /tasks/my) where there is no single project context
 * to enforce membership against.
 */
export const SkipTaskAccessGuard = () =>
  SetMetadata(SKIP_TASK_ACCESS_GUARD_KEY, true);
