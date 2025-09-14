import { Request, Response, NextFunction } from 'express';

/**
 * 404 Not Found middleware
 */
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

export default notFound;