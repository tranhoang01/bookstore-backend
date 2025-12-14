// src/modules/stats/stats.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

/**
 * GET /stats/top-books (ADMIN)
 * Query:
 *  - limit (default 10, max 50)
 *  - metric (optional): "reviewCount" | "avgRating"
 *
 * 기본: reviewCount DESC
 */
export async function topBooksController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limitRaw = parseInt((req.query.limit as string) || "10", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 50);
    const metric = ((req.query.metric as string) || "reviewCount").trim();

    const allowed = ["reviewCount", "avgRating"];
    if (!allowed.includes(metric)) {
      throw new ApiError(
        400,
        "INVALID_QUERY_PARAM",
        "metric 값이 올바르지 않습니다. (reviewCount | avgRating)",
        { metric }
      );
    }

    const orderBy: any = { [metric]: "desc" };

    const books = await prisma.book.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy,
      select: {
        id: true,
        title: true,
        price: true,
        avgRating: true,
        reviewCount: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        metric,
        limit,
        items: books,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stats/daily (ADMIN)
 * - 최근 N일 간 주문/리뷰 생성 건수
 * Query:
 *  - days (default 7, max 30)
 */
export async function dailyStatsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const daysRaw = parseInt((req.query.days as string) || "7", 10);
    const days = Math.min(Math.max(daysRaw, 1), 30);

    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    // Prisma의 groupBy는 Date trunc가 DB마다 다르므로,
    // 간단히 raw query로 날짜별 집계를 처리 (MySQL 기준)
    const orders = await prisma.$queryRaw<
      { day: string; count: number }[]
    >`
      SELECT DATE(createdAt) as day, COUNT(*) as count
      FROM \`Order\`
      WHERE createdAt >= ${since}
      GROUP BY DATE(createdAt)
      ORDER BY day ASC
    `;

    const reviews = await prisma.$queryRaw<
      { day: string; count: number }[]
    >`
      SELECT DATE(createdAt) as day, COUNT(*) as count
      FROM \`Review\`
      WHERE createdAt >= ${since}
      GROUP BY DATE(createdAt)
      ORDER BY day ASC
    `;

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        days,
        since: since.toISOString(),
        orders,
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
}
