// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/error";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      timestamp: new Date().toISOString(),
      path: req.path,
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details ?? null,
    });
  }

  return res.status(500).json({
    timestamp: new Date().toISOString(),
    path: req.path,
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "서버 내부 오류가 발생했습니다.", // Server internal error
    details: null,
  });
}
