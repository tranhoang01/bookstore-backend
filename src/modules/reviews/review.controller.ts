// src/modules/reviews/review.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

// ---------- helpers ----------
function parseId(param?: string, name = "ID") {
  if (!param) throw new ApiError(400, "BAD_REQUEST", `${name}가 필요합니다.`);
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "BAD_REQUEST", `유효하지 않은 ${name} 입니다.`);
  }
  return id;
}

async function recomputeBookRating(bookId: number) {
  // deletedAt 없는 리뷰만 집계
  const agg = await prisma.review.aggregate({
    where: { bookId, deletedAt: null },
    _count: { id: true },
    _avg: { rating: true },
  });

  const reviewCount = agg._count.id ?? 0;
  const avgRating = agg._avg.rating ?? 0;

  await prisma.book.update({
    where: { id: bookId },
    data: {
      reviewCount,
      avgRating: avgRating as any, // Prisma Decimal 호환을 위해 any 처리(실무에선 Decimal로 변환)
    },
  });
}

// ---------- GET /reviews/books/:bookId ----------
/**
 * Query:
 *  - page (default 1), size (default 20, max 100)
 *  - sort (default createdAt,DESC) allowed: createdAt, likeCount, rating
 */
export async function listReviewsForBookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const bookId = parseId(req.params.bookId, "bookId");
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const size = Math.min(Math.max(Number(req.query.size ?? 20), 1), 100);

    const sortQuery = (req.query.sort as string | undefined) ?? "likeCount,DESC";
    const [rawField = "", rawDir] = sortQuery.split(",");

    const sortDir = rawDir?.toUpperCase() === "ASC" ? "asc" : "desc";

    const ALLOWED = ["likeCount", "rating", "createdAt"] as const;
    type SortField = (typeof ALLOWED)[number];

    const sortField: SortField = (ALLOWED as readonly string[]).includes(rawField)
        ? (rawField as SortField)
        : "likeCount";

    // book 존재 확인(선택)
    const book = await prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!book) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    }

    const where = { bookId, deletedAt: null };

    const total = await prisma.review.count({ where });

    const reviews = await prisma.review.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { [sortField]: sortDir },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        book: { id: book.id, title: book.title },
        content: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          content: r.content,
          likeCount: r.likeCount,
          commentCount: r.commentCount,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          user: r.user,
        })),
        page: page - 1,
        size,
        totalElements: total,
        totalPages: Math.ceil(total / size),
        sort: `${sortField},${sortDir.toUpperCase()}`,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- POST /reviews/books/:bookId ----------
/**
 * Body: { rating: 1~5, title?: string, content: string }
 * 제약: 한 유저가 한 도서에 리뷰 1개 (@@unique([userId, bookId]))
 */
export async function createReviewForBookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const bookId = parseId(req.params.bookId, "bookId");
    const authUser = (req as any).user as { id: number; role: string } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    const { rating, title, content } = req.body as {
      rating: number;
      title?: string;
      content: string;
    };

    // validation
    if (!content || typeof content !== "string" || content.trim().length < 1) {
      throw new ApiError(400, "VALIDATION_FAILED", "content 은(는) 필수입니다.");
    }
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new ApiError(400, "VALIDATION_FAILED", "rating 은 1~5 이어야 합니다.");
    }
    if (title != null && (typeof title !== "string" || title.length > 100)) {
      throw new ApiError(400, "VALIDATION_FAILED", "title 길이는 최대 100자 입니다.");
    }

    // book exists
    const book = await prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: { id: true },
    });
    if (!book) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    }

    // create review (unique constraint)
    const created = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          bookId,
          userId: authUser.id,
          rating: r,
          title: title ?? null,
          content: content.trim(),
        },
        select: { id: true, createdAt: true },
      });

      // Book avgRating/reviewCount 재계산
      const agg = await tx.review.aggregate({
        where: { bookId, deletedAt: null },
        _count: { id: true },
        _avg: { rating: true },
      });

      await tx.book.update({
        where: { id: bookId },
        data: {
          reviewCount: agg._count.id ?? 0,
          avgRating: (agg._avg.rating ?? 0) as any,
        },
      });

      return review;
    });

    return res.status(201).json({
      isSuccess: true,
      message: "리뷰가 작성되었습니다.",
      payload: {
        reviewId: created.id,
        createdAt: created.createdAt,
      },
    });
  } catch (err: any) {
    // Prisma unique violation (userId+bookId)
    if (err?.code === "P2002") {
      return next(
        new ApiError(409, "DUPLICATE_RESOURCE", "이미 해당 도서에 리뷰를 작성했습니다.")
      );
    }
    next(err);
  }
}

// ---------- PATCH /reviews/:id ----------
/**
 * 작성자 본인만 수정
 * Body: { rating?, title?, content? }
 */
export async function updateReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewId = parseId(req.params.id, "reviewId");
    const authUser = (req as any).user as { id: number; role: string } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    const existing = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, bookId: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "리뷰를 찾을 수 없습니다.");
    }
    if (existing.userId !== authUser.id) {
      throw new ApiError(403, "FORBIDDEN", "리뷰 수정 권한이 없습니다.");
    }

    const { rating, title, content } = req.body as {
      rating?: number;
      title?: string | null;
      content?: string;
    };

    if (rating == null && title == null && content == null) {
      throw new ApiError(400, "VALIDATION_FAILED", "수정할 필드가 없습니다.");
    }

    const data: any = {};
    if (rating != null) {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        throw new ApiError(400, "VALIDATION_FAILED", "rating 은 1~5 이어야 합니다.");
      }
      data.rating = r;
    }
    if (title != null) {
      if (typeof title !== "string" || title.length > 100) {
        throw new ApiError(400, "VALIDATION_FAILED", "title 길이는 최대 100자 입니다.");
      }
      data.title = title;
    }
    if (content != null) {
      if (typeof content !== "string" || content.trim().length < 1) {
        throw new ApiError(400, "VALIDATION_FAILED", "content 값이 올바르지 않습니다.");
      }
      data.content = content.trim();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.review.update({
        where: { id: reviewId },
        data,
        select: { id: true, updatedAt: true, bookId: true },
      });

      // rating 변경 가능성이 있으니 재계산
      const agg = await tx.review.aggregate({
        where: { bookId: existing.bookId, deletedAt: null },
        _count: { id: true },
        _avg: { rating: true },
      });

      await tx.book.update({
        where: { id: existing.bookId },
        data: {
          reviewCount: agg._count.id ?? 0,
          avgRating: (agg._avg.rating ?? 0) as any,
        },
      });

      return r;
    });

    return res.status(200).json({
      isSuccess: true,
      message: "리뷰가 수정되었습니다.",
      payload: { reviewId: updated.id, updatedAt: updated.updatedAt },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- DELETE /reviews/:id ----------
/**
 * 작성자 본인만 삭제 (soft delete)
 */
export async function deleteReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewId = parseId(req.params.id, "reviewId");
    const authUser = (req as any).user as { id: number; role: string } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    const existing = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, bookId: true, deletedAt: true },
    });
    if (!existing) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "리뷰를 찾을 수 없습니다.");
    }
    if (existing.userId !== authUser.id) {
      throw new ApiError(403, "FORBIDDEN", "리뷰 삭제 권한이 없습니다.");
    }
    if (existing.deletedAt) {
      return res.status(200).json({
        isSuccess: true,
        message: "이미 삭제된 리뷰입니다.",
        payload: { reviewId, deletedAt: existing.deletedAt },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.review.update({
        where: { id: reviewId },
        data: { deletedAt: new Date() },
        select: { id: true, deletedAt: true },
      });

      // 좋아요도 함께 정리 (선택)
      await tx.reviewLike.deleteMany({ where: { reviewId } });

      // book rating/reviewCount 재계산
      const agg = await tx.review.aggregate({
        where: { bookId: existing.bookId, deletedAt: null },
        _count: { id: true },
        _avg: { rating: true },
      });

      await tx.book.update({
        where: { id: existing.bookId },
        data: {
          reviewCount: agg._count.id ?? 0,
          avgRating: (agg._avg.rating ?? 0) as any,
        },
      });

      return r;
    });

    return res.status(200).json({
      isSuccess: true,
      message: "리뷰가 삭제 처리되었습니다.",
      payload: { reviewId: result.id, deletedAt: result.deletedAt },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- POST /reviews/:id/like ----------
export async function likeReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewId = parseId(req.params.id, "reviewId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    const review = await prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true },
    });
    if (!review) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "리뷰를 찾을 수 없습니다.");
    }

    await prisma.$transaction(async (tx) => {
      // 이미 좋아요면 idempotent
      const exists = await tx.reviewLike.findUnique({
        where: { userId_reviewId: { userId: authUser.id, reviewId } },
      });

      if (exists) return;

      await tx.reviewLike.create({
        data: { userId: authUser.id, reviewId },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: { likeCount: { increment: 1 } },
      });
    });

    return res.status(200).json({
      isSuccess: true,
      message: "리뷰 좋아요 등록",
      payload: null,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- DELETE /reviews/:id/like ----------
export async function unlikeReviewController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewId = parseId(req.params.id, "reviewId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    await prisma.$transaction(async (tx) => {
      const exists = await tx.reviewLike.findUnique({
        where: { userId_reviewId: { userId: authUser.id, reviewId } },
      });

      if (!exists) return;

      await tx.reviewLike.delete({
        where: { userId_reviewId: { userId: authUser.id, reviewId } },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: { likeCount: { decrement: 1 } },
      });
    });

    return res.status(200).json({
      isSuccess: true,
      message: "리뷰 좋아요 취소",
      payload: null,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- GET /reviews/top ----------
/**
 * Top-N endpoint (public)
 * - limit(default 10, max 50)
 * - sort(default likeCount,DESC) allowed: likeCount, rating, createdAt
 *
 * ✅ 캐시/성능 고려:
 *  - 실무에서는 Redis 캐시 or DB materialized view 사용
 *  - 여기서는 구조만 갖추고 주석으로 명시
 */
export async function getTopReviewsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);

    const sortQuery = (req.query.sort as string | undefined) ?? "likeCount,DESC";
    const [rawField = "", rawDir] = sortQuery.split(",");

    const sortDir = rawDir?.toUpperCase() === "ASC" ? "asc" : "desc";

    const ALLOWED = ["likeCount", "rating", "createdAt"] as const;
    type SortField = (typeof ALLOWED)[number];

    const sortField: SortField = (ALLOWED as readonly string[]).includes(rawField)
        ? (rawField as SortField)
        : "likeCount";

    // (cache idea) key: topReviews:{sortField}:{sortDir}:{limit}
    const items = await prisma.review.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy: { [sortField]: sortDir },
      include: {
        user: { select: { id: true, name: true } },
        book: { select: { id: true, title: true } },
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        limit,
        sort: `${sortField},${sortDir.toUpperCase()}`,
        items: items.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          content: r.content,
          likeCount: r.likeCount,
          commentCount: r.commentCount,
          createdAt: r.createdAt,
          user: r.user,
          book: r.book,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}
