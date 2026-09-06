import { Router } from 'express';
import { PaimanaController } from './paimana.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { roleGuard } from '../../middleware/roleGuard.js';

const router = Router();

// Protect all routes with JWT authentication
router.use(requireAuth);

// Connectivity & Integration status
router.get('/status', PaimanaController.getStatus);

// Historical Reference Dataset with Engineered ML Features
router.get('/historical-dataset', PaimanaController.getHistoricalDataset);

// Sector-wise empirical statistical distributions and delay ratios
router.get('/benchmarks', PaimanaController.getSectorBenchmarks);

// Predict risk using calibrated MoSPI statistical logistic model
router.post('/predict-risk', PaimanaController.predictRisk);

// Batch Ingestion of new MoSPI Flash Report records (Admin only)
router.post(
  '/ingest',
  roleGuard(['superadmin', 'ministry_admin']),
  PaimanaController.ingestBatch
);

// Fetch PAiMANA projects list
router.get('/projects', PaimanaController.getProjects);

// Fetch specific PAiMANA project by projectCode or ID
router.get('/projects/:code', PaimanaController.getProjectByCode);

// Compare RapidBuilt project against MoSPI PAiMANA records
router.get('/compare/:projectId', PaimanaController.compareProject);

// Sync RapidBuilt project with PAiMANA data & recalculate risk (Restricted to Admins & Project Officers)
router.post(
  '/sync/:projectId',
  roleGuard(['superadmin', 'ministry_admin', 'project_officer']),
  PaimanaController.syncProject
);

export default router;
