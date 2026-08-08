import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log error to system_errors database table asynchronously
  const tenantId = (req as any).user?.tenant_id || null;
  query(
    'INSERT INTO system_errors (tenant_id, error_message, stack_trace) VALUES ($1, $2, $3)',
    [tenantId, message, err.stack || null]
  ).catch(dbErr => console.error('Failed to log system error to database:', dbErr));

  res.status(status).json({ error: message });
};
