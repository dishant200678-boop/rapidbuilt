import { z } from 'zod';

const milestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name is required'),
  targetDate: z.string().or(z.date()).transform((val) => new Date(val)),
  actualDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : undefined)),
  status: z.enum(['Completed', 'Pending', 'Delayed']).default('Pending'),
});

export const createProjectSchema = z.object({
  body: z.object({
    projectCode: z.string().min(3, 'Project code must be at least 3 characters'),
    name: z.string().min(3, 'Project name must be at least 3 characters'),
    ministry: z.string().min(2, 'Ministry is required'),
    sector: z.string().min(2, 'Sector is required'),
    state: z.string().min(2, 'State is required'),
    originalCost: z.number().positive('Original cost must be positive'),
    revisedCost: z.number().positive('Revised cost must be positive').optional(),
    actualExpenditure: z.number().min(0).default(0),
    startDate: z.string().or(z.date()).transform((val) => new Date(val)),
    scheduledCompletionDate: z.string().or(z.date()).transform((val) => new Date(val)),
    revisedCompletionDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : undefined)),
    physicalProgressPct: z.number().min(0).max(100).default(0),
    financialProgressPct: z.number().min(0).max(100).default(0),
    scheduledProgressPct: z.number().min(0).max(100).default(0),
    status: z.enum(['Active', 'Delayed', 'Completed', 'Stalled', 'Under Review']).optional(),
    contractorName: z.string().optional(),
    contractorPerformanceScore: z.number().min(0).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    landAcquisitionStatus: z.enum(['Approved', 'In-Progress', 'Delayed', 'Pending']).optional(),
    environmentalClearance: z.enum(['Granted', 'Pending', 'Delayed', 'Not Required']).optional(),
    milestoneDelaysCount: z.number().min(0).optional().default(0),
    milestones: z.array(milestoneSchema).optional().default([]),
  }),
});

export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    ministry: z.string().optional(),
    sector: z.string().optional(),
    state: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    revisedCost: z.number().positive().optional(),
    actualExpenditure: z.number().min(0).optional(),
    revisedCompletionDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : undefined)),
    physicalProgressPct: z.number().min(0).max(100).optional(),
    financialProgressPct: z.number().min(0).max(100).optional(),
    scheduledProgressPct: z.number().min(0).max(100).optional(),
    status: z.enum(['Active', 'Delayed', 'Completed', 'Stalled', 'Under Review']).optional(),
    contractorName: z.string().optional(),
    contractorPerformanceScore: z.number().min(0).max(100).optional(),
    landAcquisitionStatus: z.enum(['Approved', 'In-Progress', 'Delayed', 'Pending']).optional(),
    environmentalClearance: z.enum(['Granted', 'Pending', 'Delayed', 'Not Required']).optional(),
    milestoneDelaysCount: z.number().min(0).optional(),
    milestones: z.array(milestoneSchema).optional(),
  }),
});

export const queryProjectsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
    limit: z.string().optional().transform((v) => (v ? Math.min(100, parseInt(v, 10)) : 20)),
    sector: z.string().optional(),
    ministry: z.string().optional(),
    state: z.string().optional(),
    riskCategory: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['Active', 'Delayed', 'Completed', 'Stalled', 'Under Review']).optional(),
    search: z.string().optional(),
    sortBy: z.string().optional().default('riskScore'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});
