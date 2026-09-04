import { AnalyticsService } from './analytics.service.js';
export class AnalyticsController {
    static async explainProjectRisk(req, res) {
        const explanation = await AnalyticsService.explainProjectRisk(req.params.projectId);
        res.status(200).json({
            success: true,
            data: explanation,
        });
    }
    static async simulateWhatIf(req, res) {
        const simulationResult = await AnalyticsService.simulateWhatIf(req.params.projectId, req.body);
        res.status(200).json({
            success: true,
            data: simulationResult,
        });
    }
    static async getBenchmarks(_req, res) {
        const benchmarks = AnalyticsService.getBenchmarks();
        res.status(200).json({
            success: true,
            data: benchmarks,
        });
    }
}
