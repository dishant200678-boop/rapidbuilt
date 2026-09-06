import { Request, Response } from 'express';
import { MapsService, MapFilter } from './maps.service.js';

export class MapsController {
  static async getGeoJson(req: Request, res: Response): Promise<void> {
    const filter: MapFilter = {
      state: req.query.state as string,
      ministry: req.query.ministry as string,
      sector: req.query.sector as string,
      riskCategory: req.query.riskCategory as string,
      status: req.query.status as string,
    };

    const geoJson = await MapsService.getGeoJson(filter);
    res.status(200).json({
      success: true,
      data: geoJson,
    });
  }

  static async getMarkers(req: Request, res: Response): Promise<void> {
    const filter: MapFilter = {
      state: req.query.state as string,
      ministry: req.query.ministry as string,
      sector: req.query.sector as string,
      riskCategory: req.query.riskCategory as string,
      status: req.query.status as string,
    };

    const markers = await MapsService.getMarkers(filter);
    res.status(200).json({
      success: true,
      count: markers.length,
      data: markers,
    });
  }

  static async getStateSummary(req: Request, res: Response): Promise<void> {
    const filter: MapFilter = {
      ministry: req.query.ministry as string,
      sector: req.query.sector as string,
      riskCategory: req.query.riskCategory as string,
      status: req.query.status as string,
    };

    const summary = await MapsService.getStateSummary(filter);
    res.status(200).json({
      success: true,
      count: summary.length,
      data: summary,
    });
  }
}
