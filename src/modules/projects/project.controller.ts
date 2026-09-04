import { Request, Response } from 'express';
import { ProjectService } from './project.service.js';

export class ProjectController {
  static async createProject(req: Request, res: Response): Promise<void> {
    const project = await ProjectService.createProject(req.body, req.user!);
    res.status(201).json({
      success: true,
      data: project,
    });
  }

  static async getProjects(req: Request, res: Response): Promise<void> {
    const { projects, total, page, limit, totalPages } = await ProjectService.getProjects(req.query as any);
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

  static async getProjectById(req: Request, res: Response): Promise<void> {
    const project = await ProjectService.getProjectById(req.params.id as string);
    res.status(200).json({
      success: true,
      data: project,
    });
  }

  static async updateProject(req: Request, res: Response): Promise<void> {
    const project = await ProjectService.updateProject(req.params.id as string, req.body, req.user!);
    res.status(200).json({
      success: true,
      data: project,
    });
  }

  static async deleteProject(req: Request, res: Response): Promise<void> {
    await ProjectService.deleteProject(req.params.id as string, req.user!);
    res.status(200).json({
      success: true,
      data: {
        message: 'Project deleted successfully',
      },
    });
  }

  static async getSummaryStats(_req: Request, res: Response): Promise<void> {
    const stats = await ProjectService.getSummaryStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  }
}
