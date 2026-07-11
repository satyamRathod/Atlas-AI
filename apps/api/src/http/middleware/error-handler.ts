import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('===== ERROR =====');
  console.dir(error, { depth: null });

  res.status(500).json({
    message: 'Internal Server Error',
  });
};
