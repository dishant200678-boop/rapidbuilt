import { ProjectService } from '../projects/project.service.js';
import { RiskEngine } from './riskEngine.js';
import { BenchmarkEngine } from './benchmark.js';
export class AnalyticsService {
    static async explainProjectRisk(projectId) {
        const project = await ProjectService.getProjectById(projectId);
        return {
            project: {
                _id: project._id,
                projectCode: project.projectCode,
                name: project.name,
                ministry: project.ministry,
                sector: project.sector,
                state: project.state,
                originalCost: project.originalCost,
                revisedCost: project.revisedCost,
                actualExpenditure: project.actualExpenditure,
                physicalProgressPct: project.physicalProgressPct,
                financialProgressPct: project.financialProgressPct,
                scheduledProgressPct: project.scheduledProgressPct,
            },
            riskAssessment: {
                riskScore: project.riskScore,
                riskCategory: project.riskCategory,
                delayProbability: project.delayProbability,
                costOverrunProbability: project.costOverrunProbability,
                expectedDelayMonths: project.expectedDelayMonths,
                projectedCostOverrunCr: project.projectedCostOverrunCr,
            },
            shapAttributions: {
                baseValueScore: 15, // Baseline population risk average
                totalRiskScore: project.riskScore,
                factors: project.shapFactors,
            },
            derivedMetrics: {
                progressGapPct: project.progressGap,
                costGrowthPct: project.costGrowthPct,
                burnRateCrMonth: project.burnRate,
                expenditureVsProgressDiscrepancy: project.expenditureVsProgressDiscrepancy,
            },
            recommendedActions: project.recommendedActions,
        };
    }
    static async simulateWhatIf(projectId, input) {
        const project = await ProjectService.getProjectById(projectId);
        const baselineRisk = {
            riskScore: project.riskScore,
            riskCategory: project.riskCategory,
            delayProbability: project.delayProbability,
            expectedDelayMonths: project.expectedDelayMonths,
            costOverrunProbability: project.costOverrunProbability,
            projectedCostOverrunCr: project.projectedCostOverrunCr,
        };
        // Apply hypothetical scenario modifications
        const simulatedProject = {
            originalCost: project.originalCost,
            revisedCost: project.revisedCost + (input.additionalBudgetCr || 0),
            actualExpenditure: project.actualExpenditure,
            startDate: project.startDate,
            scheduledCompletionDate: project.scheduledCompletionDate,
            physicalProgressPct: Math.min(100, project.physicalProgressPct + (input.physicalProgressBoostPct || 0)),
            financialProgressPct: project.financialProgressPct,
            scheduledProgressPct: project.scheduledProgressPct,
            milestoneDelaysCount: Math.max(0, project.milestoneDelaysCount - (input.resolvedMilestonesCount || 0)),
            contractorPerformanceScore: input.accelerateContractor
                ? Math.min(100, (project.contractorPerformanceScore || 70) + 15)
                : project.contractorPerformanceScore,
            landAcquisitionStatus: project.landAcquisitionStatus,
            environmentalClearance: project.environmentalClearance,
        };
        const simulatedRisk = RiskEngine.evaluateProjectRisk(simulatedProject);
        const riskScoreDelta = Math.round((baselineRisk.riskScore - simulatedRisk.riskScore) * 10) / 10;
        const monthsSaved = Math.max(0, baselineRisk.expectedDelayMonths - simulatedRisk.expectedDelayMonths);
        const costSavingsCr = Math.max(0, baselineRisk.projectedCostOverrunCr - simulatedRisk.projectedCostOverrunCr);
        return {
            projectId: project._id,
            projectCode: project.projectCode,
            projectName: project.name,
            appliedSimulation: input,
            baseline: baselineRisk,
            simulated: {
                riskScore: simulatedRisk.riskScore,
                riskCategory: simulatedRisk.riskCategory,
                delayProbability: simulatedRisk.delayProbability,
                expectedDelayMonths: simulatedRisk.expectedDelayMonths,
                costOverrunProbability: simulatedRisk.costOverrunProbability,
                projectedCostOverrunCr: simulatedRisk.projectedCostOverrunCr,
            },
            impact: {
                riskScoreReduction: riskScoreDelta,
                monthsSaved,
                costSavingsCr,
                statusTransition: `${baselineRisk.riskCategory.toUpperCase()} → ${simulatedRisk.riskCategory.toUpperCase()}`,
            },
            prescriptiveAdvice: riskScoreDelta > 0
                ? `Intervention reduces implementation risk by ${riskScoreDelta} points and accelerates delivery by ${monthsSaved} months.`
                : 'Proposed scenario produces nominal risk reduction; consider physical pace acceleration.',
        };
    }
    static getBenchmarks() {
        return BenchmarkEngine.getModelBenchmarks();
    }
}
