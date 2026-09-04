import { ProjectService } from './project.service.js';
export class ProjectController {
    static async createProject(req, res) {
        const project = await ProjectService.createProject(req.body, req.user);
        res.status(201).json({
            success: true,
            data: project,
        });
    }
    static async getProjects(req, res) {
        const { projects, total, page, limit, totalPages } = await ProjectService.getProjects(req.query);
        res.status(200).json({
            success: true,
            data: projects,
            pagination: {
                total,
                page,
                limit,
                totalPages,
            },
        });
    }
    static async getProjectById(req, res) {
        const project = await ProjectService.getProjectById(req.params.id);
        res.status(200).json({
            success: true,
            data: project,
        });
    }
    static async updateProject(req, res) {
        const project = await ProjectService.updateProject(req.params.id, req.body, req.user);
        res.status(200).json({
            success: true,
            data: project,
        });
    }
    static async deleteProject(req, res) {
        await ProjectService.deleteProject(req.params.id, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: 'Project deleted successfully',
            },
        });
    }
    static async getSummaryStats(_req, res) {
        const stats = await ProjectService.getSummaryStats();
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
}
