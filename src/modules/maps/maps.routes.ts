import { Router } from 'express';
import { MapsController } from './maps.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';

const router = Router();

// Protected routes (JWT required)
router.use(requireAuth);

// Standard RFC 7946 GeoJSON FeatureCollection
router.get('/geojson', MapsController.getGeoJson);

// Fast lightweight marker pins for interactive maps
router.get('/markers', MapsController.getMarkers);

// State-level aggregated summaries for choropleth heatmaps
router.get('/state-summary', MapsController.getStateSummary);

export default router;
