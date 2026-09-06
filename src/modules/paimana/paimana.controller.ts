import { Request, Response, NextFunction } from 'express';
import { PaimanaService } from '../../services/paimana.service.js';

export class PaimanaController {
  /**
   * GET /api/paimana/status
   * Integration and connectivity status with MoSPI PAiMANA
   */
  static async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await PaimanaService.getIntegrationStatus();
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/paimana/projects
   * Fetch Central Sector projects list from PAiMANA
   */
  static async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaimanaService.fetchProjects({
        ministry: req.query.ministry as string,
        sector: req.query.sector as string,
        state: req.query.state as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        source: result.source,
        isSimulated: result.isSimulated,
        total: result.total,
        count: result.projects.length,
        data: result.projects,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/paimana/projects/:code
   * Fetch single project by projectCode or PAiMANA ID
   */
  static async getProjectByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
      const project = await PaimanaService.fetchProjectByCode(code);
      res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/paimana/compare/:projectId
   * Compare PRAGATI project data with official MoSPI PAiMANA portal records
   */
  static async compareProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
      const comparison = await PaimanaService.compareWithRapidBuilt(projectId);
      res.status(200).json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/paimana/sync/:projectId
   * Synchronize PRAGATI project with PAiMANA official data & re-evaluate AI risk metrics
   */
  static async syncProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
      const result = await PaimanaService.syncAndEvaluateRisk(projectId);
      res.status(200).json({
        success: true,
        message: 'Project successfully synchronized with MoSPI PAiMANA portal',
        data: {
          projectCode: result.project.projectCode,
          name: result.project.name,
          appliedUpdates: result.appliedUpdates,
          newRiskScore: result.project.riskScore,
          newRiskCategory: result.project.riskCategory,
          alertCreated: result.alertCreated,
          lastEvaluatedAt: result.project.lastEvaluatedAt,
          paimanaSource: result.paimanaSource,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/paimana/historical-dataset
   * Retrieve cleaned MoSPI reference projects with engineered ML features
   */
  static async getHistoricalDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaimanaService.fetchProjects({
        sector: req.query.sector as string,
        ministry: req.query.ministry as string,
        state: req.query.state as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });

      const datasetWithFeatures = result.projects.map((p) => ({
        ...p,
        engineeredFeatures: PaimanaService.engineerFeatures(p),
      }));

      res.status(200).json({
        success: true,
        total: result.total,
        count: datasetWithFeatures.length,
        source: result.source,
        data: datasetWithFeatures,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/paimana/benchmarks
   * Sector-wise empirical statistical distributions and delay ratios from MoSPI dataset
   */
  static async getSectorBenchmarks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const benchmarks = PaimanaService.computeSectorBenchmarks();
      res.status(200).json({
        success: true,
        count: benchmarks.length,
        data: benchmarks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/paimana/predict-risk
   * Evaluates project parameters against the MoSPI calibrated statistical risk model
   */
  static async predictRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prediction = PaimanaService.evaluatePredictiveRisk(req.body);
      res.status(200).json({
        success: true,
        data: prediction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/paimana/ingest
   * Ingest a batch of MoSPI Central Sector project records (JSON format)
   */
  static async ingestBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const records = req.body.records || (Array.isArray(req.body) ? req.body : [req.body]);
      const result = PaimanaService.ingestMoSPIBatch(records);
      res.status(201).json({
        success: true,
        message: `Successfully ingested ${result.ingestedCount} project records into MoSPI reference corpus`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/paimana/verify-live
   * Executes a real live data fetch against official MoSPI public endpoints
   */
  static async verifyPublicAccess(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const liveCheck = await PaimanaService.verifyPublicPaimanaAccess();
      res.status(200).json({
        success: true,
        data: liveCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/paimana/ingest-csv
   * Ingest project datasets from raw CSV text (e.g. exported MoSPI Flash Reports)
   */
  static async ingestCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csvContent = typeof req.body === 'string' ? req.body : req.body.csv || req.body.content;
      const result = PaimanaService.ingestMoSPICsv(csvContent);
      res.status(201).json({
        success: true,
        message: `Successfully parsed and ingested ${result.ingestedCount} projects from CSV`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
