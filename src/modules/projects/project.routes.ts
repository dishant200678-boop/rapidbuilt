import { Router } from 'express';
import { ProjectController } from './project.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { createProjectSchema, updateProjectSchema, queryProjectsSchema } from './project.schema.js';
import { roleGuard } from '../../middleware/roleGuard.js';

const router = Router();

router.use(requireAuth);

router.get('/statistics/summary', ProjectController.getSummaryStats);
router.get('/', validate(queryProjectsSchema), ProjectController.getProjects);
router.get('/:id', ProjectController.getProjectById);

router.post(
  '/',
  roleGuard(['superadmin', 'ministry_admin', 'project_officer']),
  validate(createProjectSchema),
  ProjectController.createProject
);

router.patch(
  '/:id',
  roleGuard(['superadmin', 'ministry_admin', 'project_officer']),
  validate(updateProjectSchema),
  ProjectController.updateProject
);

router.delete(
  '/:id',
  roleGuard(['superadmin', 'ministry_admin', 'project_officer']),
  ProjectController.deleteProject
);

export default router;
