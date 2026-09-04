import { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service.js';

export class AnalyticsController {
  static async explainProjectRisk(req: Request, res: Response): Promise<void> {
    const explanation = await AnalyticsService.explainProjectRisk(req.params.projectId as string);
    res.status(200).json({
      success: true,
      data: explanation,
    });
  }

  static async simulateWhatIf(req: Request, res: Response): Promise<void> {
    const simulationResult = await AnalyticsService.simulateWhatIf(req.params.projectId as string, req.body);
    res.status(200).json({
      success: true,
      data: simulationResult,
    });
  }

  static async getBenchmarks(_req: Request, res: Response): Promise<void> {
    const benchmarks = AnalyticsService.getBenchmarks();
    res.status(200).json({
      success: true,
      data: benchmarks,
    });
  }
}
