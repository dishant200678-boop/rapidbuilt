export class RiskEngine {
    /**
     * Evaluates project health, runs feature engineering, and calculates
     * risk score, probabilities, SHAP feature attributions, and prescriptive recommendations.
     */
    static evaluateProjectRisk(project) {
        const originalCost = project.originalCost || 1;
        const revisedCost = project.revisedCost || originalCost;
        const actualExpenditure = project.actualExpenditure || 0;
        const physicalProgress = project.physicalProgressPct ?? 0;
        const financialProgress = project.financialProgressPct ?? 0;
        const scheduledProgress = project.scheduledProgressPct ?? 0;
        const milestoneDelays = project.milestoneDelaysCount ?? 0;
        const contractorScore = project.contractorPerformanceScore ?? 75;
        // 1. Feature Engineering
        const progressGap = Math.round((scheduledProgress - physicalProgress) * 10) / 10;
        const costGrowthPct = Math.round((((revisedCost - originalCost) / originalCost) * 100) * 10) / 10;
        const expenditureVsProgressDiscrepancy = Math.round((financialProgress - physicalProgress) * 10) / 10;
        // Estimate project elapsed months
        const start = project.startDate ? new Date(project.startDate).getTime() : Date.now();
        const scheduledEnd = project.scheduledCompletionDate
            ? new Date(project.scheduledCompletionDate).getTime()
            : start + 365 * 24 * 3600 * 1000;
        const totalDurationMonths = Math.max(1, Math.round((scheduledEnd - start) / (30.44 * 24 * 3600 * 1000)));
        const elapsedMonths = Math.max(1, Math.round((Date.now() - start) / (30.44 * 24 * 3600 * 1000)));
        const burnRate = Math.round((actualExpenditure / elapsedMonths) * 100) / 100;
        // 2. Risk Factors Computation & Attributions (SHAP surrogate)
        const shapFactors = [];
        // Factor A: Progress Gap (Scheduled - Actual)
        let progressGapRisk = 0;
        if (progressGap > 25) {
            progressGapRisk = 30;
            shapFactors.push({
                factor: 'Severe Progress Gap',
                contribution: 30,
                description: `Actual progress is ${progressGap}% behind scheduled progress`,
            });
        }
        else if (progressGap > 10) {
            progressGapRisk = 18;
            shapFactors.push({
                factor: 'Moderate Progress Gap',
                contribution: 18,
                description: `Project is lagging by ${progressGap}% behind planned schedule`,
            });
        }
        else if (progressGap > 0) {
            progressGapRisk = 8;
            shapFactors.push({
                factor: 'Minor Progress Lag',
                contribution: 8,
                description: `Slight slippage of ${progressGap}%`,
            });
        }
        // Factor B: Financial Expenditure vs Physical Progress (Discrepancy / Overspending)
        let financialDiscrepancyRisk = 0;
        if (expenditureVsProgressDiscrepancy > 25) {
            financialDiscrepancyRisk = 25;
            shapFactors.push({
                factor: 'High Expenditure Discrepancy',
                contribution: 25,
                description: `Spent ${financialProgress}% budget but achieved only ${physicalProgress}% physical output`,
            });
        }
        else if (expenditureVsProgressDiscrepancy > 12) {
            financialDiscrepancyRisk = 14;
            shapFactors.push({
                factor: 'Moderate Expenditure Lead',
                contribution: 14,
                description: `Expenditure outpacing physical work by ${expenditureVsProgressDiscrepancy}%`,
            });
        }
        // Factor C: Cost Escalation
        let costGrowthRisk = 0;
        if (costGrowthPct > 20) {
            costGrowthRisk = 20;
            shapFactors.push({
                factor: 'Significant Cost Escalation',
                contribution: 20,
                description: `Revised cost is ${costGrowthPct}% over initial sanctioned estimate`,
            });
        }
        else if (costGrowthPct > 5) {
            costGrowthRisk = 10;
            shapFactors.push({
                factor: 'Moderate Cost Revision',
                contribution: 10,
                description: `Cost has increased by ${costGrowthPct}%`,
            });
        }
        // Factor D: Repeated Milestone Delays
        let milestoneDelayRisk = 0;
        if (milestoneDelays >= 4) {
            milestoneDelayRisk = 18;
            shapFactors.push({
                factor: 'Chronic Milestone Delays',
                contribution: 18,
                description: `${milestoneDelays} critical project milestones have been breached`,
            });
        }
        else if (milestoneDelays >= 2) {
            milestoneDelayRisk = 10;
            shapFactors.push({
                factor: 'Milestone Slippage',
                contribution: 10,
                description: `${milestoneDelays} milestones missed`,
            });
        }
        // Factor E: External & Environmental / Contractor Risk
        let externalRisk = 0;
        if (project.landAcquisitionStatus === 'Delayed' || project.landAcquisitionStatus === 'Pending') {
            externalRisk += 8;
            shapFactors.push({
                factor: 'Land Acquisition Stalled',
                contribution: 8,
                description: 'Critical right-of-way / land clearance pending or delayed',
            });
        }
        if (project.environmentalClearance === 'Delayed') {
            externalRisk += 5;
            shapFactors.push({
                factor: 'Environmental Clearance Lag',
                contribution: 5,
                description: 'Statutory green clearances delayed',
            });
        }
        if (contractorScore < 50) {
            externalRisk += 10;
            shapFactors.push({
                factor: 'Sub-Par Contractor Performance',
                contribution: 10,
                description: `Contractor score is ${contractorScore}/100 (below threshold)`,
            });
        }
        // 3. Composite Risk Score (0 - 100)
        const rawScore = progressGapRisk + financialDiscrepancyRisk + costGrowthRisk + milestoneDelayRisk + externalRisk;
        const riskScore = Math.min(100, Math.max(0, rawScore));
        let riskCategory = 'low';
        if (riskScore >= 76)
            riskCategory = 'critical';
        else if (riskScore >= 51)
            riskCategory = 'high';
        else if (riskScore >= 26)
            riskCategory = 'medium';
        else
            riskCategory = 'low';
        // 4. Overrun & Delay Probabilities
        // Delay Probability is directly proportional to progress gap and milestone delays
        const delayProbability = Math.min(99, Math.max(5, Math.round(riskScore * 0.95 + (progressGap > 20 ? 8 : 0))));
        // Cost Overrun Probability is strongly linked to cost growth and expenditure discrepancy
        const costOverrunProbability = Math.min(98, Math.max(5, Math.round((costGrowthPct > 0 ? 50 : 10) +
            Math.min(40, costGrowthPct * 1.5) +
            Math.min(20, expenditureVsProgressDiscrepancy * 0.8))));
        // Expected Delay in Months
        let expectedDelayMonths = 0;
        if (physicalProgress < scheduledProgress && physicalProgress > 0) {
            const remainingProgress = 100 - physicalProgress;
            const currentVelocity = physicalProgress / elapsedMonths;
            const expectedTotalMonths = remainingProgress / Math.max(0.2, currentVelocity);
            expectedDelayMonths = Math.max(0, Math.round(expectedTotalMonths - (totalDurationMonths - elapsedMonths)));
        }
        else if (milestoneDelays > 0) {
            expectedDelayMonths = milestoneDelays * 2;
        }
        // Projected Cost Overrun (₹ Crores)
        let projectedCostOverrunCr = 0;
        if (costOverrunProbability > 50) {
            const escalationMultiplier = 1 + (costOverrunProbability / 100) * 0.25;
            projectedCostOverrunCr = Math.round(Math.max(0, revisedCost * escalationMultiplier - originalCost));
        }
        // 5. Prescriptive Recommendations (Actionable interventions)
        const recommendedActions = [];
        if (progressGap > 20) {
            recommendedActions.push('Mobilize additional contractor shifts and augment machinery on site.');
        }
        if (expenditureVsProgressDiscrepancy > 20) {
            recommendedActions.push('Institute immediate financial audit on mobilization advances and raw materials billing.');
        }
        if (project.landAcquisitionStatus === 'Delayed' || project.landAcquisitionStatus === 'Pending') {
            recommendedActions.push('Escalate Right-of-Way (RoW) and land acquisition with State District Collectors.');
        }
        if (milestoneDelays >= 3) {
            recommendedActions.push('Invoke liquidated damages clause and review contractor contract performance.');
        }
        if (riskCategory === 'critical') {
            recommendedActions.push('Flag project for Cabinet Secretary / Ministry Apex Committee high-level review.');
        }
        else if (recommendedActions.length === 0) {
            recommendedActions.push('Maintain regular bi-weekly monitoring schedule; project is on track.');
        }
        return {
            progressGap,
            costGrowthPct,
            burnRate,
            expenditureVsProgressDiscrepancy,
            riskScore,
            riskCategory,
            delayProbability,
            costOverrunProbability,
            expectedDelayMonths,
            projectedCostOverrunCr,
            shapFactors: shapFactors.sort((a, b) => b.contribution - a.contribution),
            recommendedActions,
        };
    }
}
