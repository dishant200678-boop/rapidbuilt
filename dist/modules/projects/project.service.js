import { Types } from 'mongoose';
import { Project } from './project.model.js';
import { RiskEngine } from '../analytics/riskEngine.js';
import { Alert } from '../alerts/alert.model.js';
import { broadcastEarlyWarning } from '../../sockets/index.js';
import { AppError } from '../../utils/ownershipCheck.js';
export class ProjectService {
    static async createProject(data, user) {
        const existing = await Project.findOne({ projectCode: data.projectCode.toUpperCase() });
        if (existing) {
            throw new AppError(409, 'CONFLICT', `Project with code "${data.projectCode}" already exists`);
        }
        // Evaluate Initial ML Risk Metrics & Features
        const riskMetrics = RiskEngine.evaluateProjectRisk({
            ...data,
            revisedCost: data.revisedCost || data.originalCost,
        });
        const project = new Project({
            ...data,
            projectCode: data.projectCode.toUpperCase(),
            revisedCost: data.revisedCost || data.originalCost,
            ...riskMetrics,
            createdBy: new Types.ObjectId(user.userId),
        });
        await project.save();
        // Trigger Early Warning Alert if risk is High or Critical
        if (project.riskScore >= 51) {
            const alert = await Alert.create({
                projectId: project._id,
                projectCode: project.projectCode,
                projectName: project.name,
                ministry: project.ministry,
                severity: project.riskScore >= 76 ? 'critical' : 'warning',
                title: `High Risk Detected on Project Intake: ${project.name}`,
                reason: project.shapFactors[0]?.description || 'Project initiated with elevated risk indicators',
                riskScore: project.riskScore,
            });
            broadcastEarlyWarning(alert);
        }
        return project;
    }
    static async getProjects(params) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;
        const filter = { isDeleted: false };
        if (params.sector)
            filter.sector = params.sector;
        if (params.ministry)
            filter.ministry = params.ministry;
        if (params.state)
            filter.state = params.state;
        if (params.riskCategory)
            filter.riskCategory = params.riskCategory;
        if (params.status)
            filter.status = params.status;
        if (params.search) {
            filter.$text = { $search: params.search };
        }
        const sortField = params.sortBy || 'riskScore';
        const sortDir = params.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortField]: sortDir };
        const [projects, total] = await Promise.all([
            Project.find(filter).sort(sort).skip(skip).limit(limit),
            Project.countDocuments(filter),
        ]);
        return {
            projects,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    static async getProjectById(id) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        const project = await Project.findOne({ _id: id, isDeleted: false });
        if (!project) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        return project;
    }
    static async updateProject(id, updates, user) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        const project = await Project.findOne({ _id: id, isDeleted: false });
        if (!project) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        // Role verification: Superadmin / Ministry Admin can edit any in ministry, Project Officer can edit own
        const canEdit = user.role === 'superadmin' ||
            (user.role === 'ministry_admin' && user.ministry === project.ministry) ||
            project.createdBy.toString() === user.userId;
        if (!canEdit) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found'); // Always 404 per blueprint
        }
        const oldRiskScore = project.riskScore;
        // Apply updates
        Object.assign(project, updates);
        // Re-evaluate ML Risk Metrics
        const reCalculated = RiskEngine.evaluateProjectRisk(project);
        Object.assign(project, reCalculated);
        project.lastEvaluatedAt = new Date();
        await project.save();
        // Trigger Early Warning Alert if risk transitioned into High or Critical
        if (project.riskScore >= 51 && oldRiskScore < 51) {
            const alert = await Alert.create({
                projectId: project._id,
                projectCode: project.projectCode,
                projectName: project.name,
                ministry: project.ministry,
                severity: project.riskScore >= 76 ? 'critical' : 'warning',
                title: `🚨 Escalated Early Warning: ${project.name}`,
                reason: `Risk score escalated from ${oldRiskScore} to ${project.riskScore}. ${project.shapFactors[0]?.description || ''}`,
                riskScore: project.riskScore,
            });
            broadcastEarlyWarning(alert);
        }
        return project;
    }
    static async deleteProject(id, user) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        const project = await Project.findOne({ _id: id, isDeleted: false });
        if (!project) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        const canDelete = user.role === 'superadmin' ||
            (user.role === 'ministry_admin' && user.ministry === project.ministry) ||
            project.createdBy.toString() === user.userId;
        if (!canDelete) {
            throw new AppError(404, 'NOT_FOUND', 'Project not found');
        }
        project.isDeleted = true;
        project.deletedAt = new Date();
        await project.save();
    }
    static async getSummaryStats() {
        const filter = { isDeleted: false };
        const [riskCounts, aggregations, topRiskiest] = await Promise.all([
            Project.aggregate([
                { $match: filter },
                { $group: { _id: '$riskCategory', count: { $sum: 1 } } },
            ]),
            Project.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalProjects: { $sum: 1 },
                        totalSanctionedCostCr: { $sum: '$originalCost' },
                        totalRevisedCostCr: { $sum: '$revisedCost' },
                        totalExpenditureCr: { $sum: '$actualExpenditure' },
                        totalProjectedOverrunCr: { $sum: '$projectedCostOverrunCr' },
                        avgProgressGap: { $avg: '$progressGap' },
                    },
                },
            ]),
            Project.find(filter)
                .sort({ riskScore: -1 })
                .limit(5)
                .select('projectCode name ministry sector riskScore riskCategory delayProbability costOverrunProbability expectedDelayMonths'),
        ]);
        const counts = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };
        riskCounts.forEach((r) => {
            counts[r._id] = r.count;
        });
        const agg = aggregations[0] || {
            totalProjects: 0,
            totalSanctionedCostCr: 0,
            totalRevisedCostCr: 0,
            totalExpenditureCr: 0,
            totalProjectedOverrunCr: 0,
            avgProgressGap: 0,
        };
        return {
            overview: {
                totalProjects: agg.totalProjects,
                totalSanctionedCostCr: Math.round(agg.totalSanctionedCostCr),
                totalRevisedCostCr: Math.round(agg.totalRevisedCostCr),
                totalExpenditureCr: Math.round(agg.totalExpenditureCr),
                totalProjectedOverrunCr: Math.round(agg.totalProjectedOverrunCr),
                avgProgressGap: Math.round((agg.avgProgressGap || 0) * 10) / 10,
            },
            riskBreakdown: counts,
            topRiskiestProjects: topRiskiest,
        };
    }
}
