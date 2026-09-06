import { Project, IProject } from '../projects/project.model.js';

// Indian States and UT Centroids (Longitude, Latitude) for automatic coordinate fallback
const STATE_CENTROIDS: Record<string, [number, number]> = {
  'andhra pradesh': [79.74, 15.91],
  'arunachal pradesh': [94.72, 28.21],
  assam: [92.93, 26.2],
  bihar: [85.31, 25.09],
  chhattisgarh: [81.86, 21.27],
  delhi: [77.1, 28.7],
  goa: [74.12, 15.29],
  gujarat: [71.19, 22.25],
  haryana: [76.08, 29.05],
  'himachal pradesh': [77.17, 31.1],
  'jammu and kashmir': [74.79, 33.77],
  jharkhand: [85.27, 23.61],
  karnataka: [75.71, 15.31],
  kerala: [76.27, 10.85],
  ladakh: [77.57, 34.15],
  'madhya pradesh': [78.65, 22.97],
  maharashtra: [75.71, 19.75],
  manipur: [93.9, 24.66],
  meghalaya: [91.36, 25.46],
  mizoram: [92.93, 23.16],
  nagaland: [94.56, 26.15],
  odisha: [85.09, 20.95],
  punjab: [75.34, 31.14],
  rajasthan: [74.21, 27.02],
  sikkim: [88.51, 27.53],
  'tamil nadu': [78.65, 11.12],
  telangana: [79.01, 18.11],
  tripura: [91.98, 23.94],
  'uttar pradesh': [80.94, 26.84],
  uttarakhand: [79.01, 30.06],
  'west bengal': [87.85, 22.98],
  chandigarh: [76.77, 30.73],
  puducherry: [79.8, 11.94],
};

const DEFAULT_INDIA_CENTROID: [number, number] = [78.9629, 20.5937]; // [Lng, Lat]

export interface MapFilter {
  state?: string;
  ministry?: string;
  sector?: string;
  riskCategory?: string;
  status?: string;
}

export class MapsService {
  /**
   * Resolve coordinates for a project. Returns [longitude, latitude]
   */
  private static resolveCoordinates(p: IProject): [number, number] {
    if (typeof p.longitude === 'number' && typeof p.latitude === 'number') {
      return [p.longitude, p.latitude];
    }
    const stateKey = (p.state || '').trim().toLowerCase();
    return STATE_CENTROIDS[stateKey] || DEFAULT_INDIA_CENTROID;
  }

  private static buildMongoQuery(filter: MapFilter) {
    const query: Record<string, any> = { isDeleted: false };
    if (filter.state) query.state = { $regex: new RegExp(`^${filter.state.trim()}$`, 'i') };
    if (filter.ministry) query.ministry = { $regex: new RegExp(`^${filter.ministry.trim()}$`, 'i') };
    if (filter.sector) query.sector = { $regex: new RegExp(`^${filter.sector.trim()}$`, 'i') };
    if (filter.riskCategory) query.riskCategory = filter.riskCategory;
    if (filter.status) query.status = filter.status;
    return query;
  }

  /**
   * Returns standard RFC 7946 GeoJSON FeatureCollection
   */
  static async getGeoJson(filter: MapFilter) {
    const query = this.buildMongoQuery(filter);
    const projects = await Project.find(query).lean();

    const features = projects.map((p) => {
      const [lng, lat] = this.resolveCoordinates(p as unknown as IProject);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: p._id,
          projectCode: p.projectCode,
          name: p.name,
          ministry: p.ministry,
          sector: p.sector,
          state: p.state,
          originalCost: p.originalCost,
          revisedCost: p.revisedCost,
          actualExpenditure: p.actualExpenditure,
          physicalProgressPct: p.physicalProgressPct,
          financialProgressPct: p.financialProgressPct,
          status: p.status,
          riskScore: p.riskScore,
          riskCategory: p.riskCategory,
          delayProbability: p.delayProbability,
          expectedDelayMonths: p.expectedDelayMonths,
          projectedCostOverrunCr: p.projectedCostOverrunCr,
          contractorName: p.contractorName,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      totalFeatures: features.length,
      features,
    };
  }

  /**
   * Returns lightweight marker array for frontends
   */
  static async getMarkers(filter: MapFilter) {
    const query = this.buildMongoQuery(filter);
    const projects = await Project.find(query).lean();

    return projects.map((p) => {
      const [lng, lat] = this.resolveCoordinates(p as unknown as IProject);
      return {
        id: p._id,
        projectCode: p.projectCode,
        name: p.name,
        state: p.state,
        ministry: p.ministry,
        sector: p.sector,
        coordinates: {
          latitude: lat,
          longitude: lng,
        },
        riskCategory: p.riskCategory,
        riskScore: p.riskScore,
        status: p.status,
        progress: {
          physical: p.physicalProgressPct,
          financial: p.financialProgressPct,
        },
        cost: {
          original: p.originalCost,
          revised: p.revisedCost,
          actual: p.actualExpenditure,
        },
      };
    });
  }

  /**
   * Returns state-wise project aggregations for choropleth heatmaps
   */
  static async getStateSummary(filter: MapFilter) {
    const matchStage: Record<string, any> = { isDeleted: false };
    if (filter.ministry) matchStage.ministry = { $regex: new RegExp(`^${filter.ministry.trim()}$`, 'i') };
    if (filter.sector) matchStage.sector = { $regex: new RegExp(`^${filter.sector.trim()}$`, 'i') };
    if (filter.riskCategory) matchStage.riskCategory = filter.riskCategory;
    if (filter.status) matchStage.status = filter.status;

    const summary = await Project.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$state',
          totalProjects: { $sum: 1 },
          criticalRiskCount: {
            $sum: { $cond: [{ $eq: ['$riskCategory', 'critical'] }, 1, 0] },
          },
          highRiskCount: {
            $sum: { $cond: [{ $eq: ['$riskCategory', 'high'] }, 1, 0] },
          },
          delayedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Delayed'] }, 1, 0] },
          },
          totalOriginalCostCr: { $sum: '$originalCost' },
          totalActualExpenditureCr: { $sum: '$actualExpenditure' },
          avgRiskScore: { $avg: '$riskScore' },
        },
      },
      {
        $sort: { totalProjects: -1 },
      },
    ]);

    return summary.map((s) => {
      const stateName = s._id || 'Unknown';
      const stateKey = stateName.trim().toLowerCase();
      const coords = STATE_CENTROIDS[stateKey] || DEFAULT_INDIA_CENTROID;

      return {
        state: stateName,
        totalProjects: s.totalProjects,
        criticalRiskCount: s.criticalRiskCount,
        highRiskCount: s.highRiskCount,
        delayedCount: s.delayedCount,
        totalOriginalCostCr: Math.round(s.totalOriginalCostCr * 100) / 100,
        totalActualExpenditureCr: Math.round(s.totalActualExpenditureCr * 100) / 100,
        avgRiskScore: Math.round((s.avgRiskScore || 0) * 10) / 10,
        centroid: {
          longitude: coords[0],
          latitude: coords[1],
        },
      };
    });
  }
}
