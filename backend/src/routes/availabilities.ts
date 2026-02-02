/**
 * Availabilities API Routes
 * Handles driver availability creation, clearing, and querying
 */

import { Router, Request, Response } from 'express';

const router = Router();

// TODO: Implement availability endpoints following same pattern as needs.ts
// - POST / - Create availability
// - PATCH /:availabilityId/clear - Clear availability
// - GET / - Query availabilities

router.post('/', async (req: Request, res: Response) => {
  res.status(501).json({
    requestId: (req as any).id,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Availabilities endpoint not yet implemented',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
