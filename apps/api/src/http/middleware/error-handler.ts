import type { ErrorRequestHandler } from 'express';

/**
 * The SSE stream endpoint re-throws after a client disconnect/abort so the
 * error gets logged, but by then headers (and often the whole response) are
 * already sent — calling `res.json()` again would throw `ERR_HTTP_HEADERS_SENT`.
 * Delegating to Express's default handler in that case just ends the socket.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({
    message: 'Internal Server Error',
    stack: error.stack,
  });
};
