import { Schema, model, Document, Types } from 'mongoose';

export type ProjectStatus = 'Active' | 'Delayed' | 'Completed' | 'Stalled' | 'Under Review';
export type RiskCategory = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'Approved' | 'In-Progress' | 'Delayed' | 'Pending' | 'Granted' | 'Not Required';

export interface IMilestone {
  name: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'Completed' | 'Pending' | 'Delayed';
}

export interface IShapFactor {
  factor: string;
  contribution: number;
  description: string;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  projectCode: string;
  name: string;
  ministry: string;
  sector: string;
  state: string;
  originalCost: number; // in ₹ Crores
  revisedCost: number; // in ₹ Crores
  actualExpenditure: number; // in ₹ Crores
  startDate: Date;
  scheduledCompletionDate: Date;
  revisedCompletionDate: Date;
  physicalProgressPct: number;
  financialProgressPct: number;
  scheduledProgressPct: number;
  status: ProjectStatus;

  // Geospatial / Map coordinates
  latitude?: number;
  longitude?: number;

  // Extended / Additional Risk Variables
  contractorName?: string;
  contractorPerformanceScore?: number; // 0 - 100
  landAcquisitionStatus?: ApprovalStatus;
  environmentalClearance?: ApprovalStatus;
  milestoneDelaysCount: number;
  milestones: IMilestone[];

  // Derived Feature Engineering Metrics
  progressGap: number; // scheduledProgressPct - physicalProgressPct
  costGrowthPct: number; // ((revisedCost - originalCost) / originalCost) * 100
  burnRate: number; // Cr per month
  expenditureVsProgressDiscrepancy: number; // financialProgressPct - physicalProgressPct

  // AI / ML Predictions
  riskScore: number; // 0 - 100
  riskCategory: RiskCategory;
  delayProbability: number; // 0 - 100 %
  costOverrunProbability: number; // 0 - 100 %
  expectedDelayMonths: number;
  projectedCostOverrunCr: number;
  shapFactors: IShapFactor[];
  recommendedActions: string[];
  lastEvaluatedAt: Date;

  // Audit & Soft Delete
  createdBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<IMilestone>(
  {
    name: { type: String, required: true },
    targetDate: { type: Date, required: true },
    actualDate: { type: Date },
    status: { type: String, enum: ['Completed', 'Pending', 'Delayed'], default: 'Pending' },
  },
  { _id: false }
);

const shapFactorSchema = new Schema<IShapFactor>(
  {
    factor: { type: String, required: true },
    contribution: { type: Number, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const projectSchema = new Schema<IProject>(
  {
    projectCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    ministry: { type: String, required: true, trim: true, index: true },
    sector: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true },
    originalCost: { type: Number, required: true, min: 0 },
    revisedCost: { type: Number, required: true, min: 0 },
    actualExpenditure: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    scheduledCompletionDate: { type: Date, required: true },
    revisedCompletionDate: { type: Date, required: true },
    physicalProgressPct: { type: Number, required: true, min: 0, max: 100 },
    financialProgressPct: { type: Number, required: true, min: 0, max: 100 },
    scheduledProgressPct: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['Active', 'Delayed', 'Completed', 'Stalled', 'Under Review'],
      default: 'Active',
      index: true,
    },

    // Geospatial coordinates
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },

    // Extended Variables
    contractorName: { type: String, trim: true },
    contractorPerformanceScore: { type: Number, min: 0, max: 100, default: 75 },
    landAcquisitionStatus: {
      type: String,
      enum: ['Approved', 'In-Progress', 'Delayed', 'Pending'],
      default: 'Approved',
    },
    environmentalClearance: {
      type: String,
      enum: ['Granted', 'Pending', 'Delayed', 'Not Required'],
      default: 'Granted',
    },
    milestoneDelaysCount: { type: Number, default: 0 },
    milestones: [milestoneSchema],

    // Derived Features
    progressGap: { type: Number, default: 0 },
    costGrowthPct: { type: Number, default: 0 },
    burnRate: { type: Number, default: 0 },
    expenditureVsProgressDiscrepancy: { type: Number, default: 0 },

    // Predictive Risk Engine
    riskScore: { type: Number, default: 0, index: true },
    riskCategory: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },
    delayProbability: { type: Number, default: 0 },
    costOverrunProbability: { type: Number, default: 0 },
    expectedDelayMonths: { type: Number, default: 0 },
    projectedCostOverrunCr: { type: Number, default: 0 },
    shapFactors: [shapFactorSchema],
    recommendedActions: [{ type: String }],
    lastEvaluatedAt: { type: Date, default: Date.now },

    // Auditing & Soft Delete
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Full-text search index on Name, Code, Ministry, and Sector
projectSchema.index(
  {
    name: 'text',
    projectCode: 'text',
    ministry: 'text',
    sector: 'text',
    state: 'text',
  },
  {
    weights: {
      projectCode: 10,
      name: 5,
      ministry: 2,
      sector: 2,
    },
    name: 'ProjectTextIndex',
  }
);

// Compound indexes for fast multi-attribute filtering
projectSchema.index({ riskCategory: 1, ministry: 1, isDeleted: 1 });
projectSchema.index({ sector: 1, riskScore: -1 });

export const Project = model<IProject>('Project', projectSchema);
