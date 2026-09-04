import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
const router = Router();
router.use(requireAuth);
const whatIfSchema = z.object({
    body: z.object({
        additionalBudgetCr: z.number().min(0).optional(),
        physicalProgressBoostPct: z.number().min(0).max(100).optional(),
        resolvedMilestonesCount: z.number().min(0).optional(),
        accelerateContractor: z.boolean().optional(),
    }),
});
router.get('/benchmarks', AnalyticsController.getBenchmarks);
router.get('/explain/:projectId', AnalyticsController.explainProjectRisk);
router.post('/what-if/:projectId', validate(whatIfSchema), AnalyticsController.simulateWhatIf);
export default router;
