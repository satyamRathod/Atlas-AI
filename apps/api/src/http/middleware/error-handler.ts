import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(500).json({
    message: 'Internal Server Error',
    stack: error.stack,
  });
};
