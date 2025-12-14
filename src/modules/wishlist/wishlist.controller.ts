// src/modules/wishlist/wishlist.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

function parseId(param?: string, name = "ID") {
  if (!param) throw new ApiError(400, "BAD_REQUEST", `${name}가 필요합니다.`);
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "BAD_REQUEST", `유효하지 않은 ${name} 입니다.`);
  }
  return id;
}

/**
 * POST /wishlist/:bookId
 * - 위시리스트 추가
 * - idempotent: 이미 있으면 그대로 성공 처리
 */
export async function addToWishlistController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const bookId = parseId(req.params.bookId, "bookId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const book = await prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: { id: true },
    });
    if (!book) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    }

    // 이미 존재하면 OK (idempotent)
    const exists = await prisma.wishlistItem.findUnique({
      where: { userId_bookId: { userId: authUser.id, bookId } },
    });

    if (!exists) {
      await prisma.wishlistItem.create({
        data: { userId: authUser.id, bookId },
      });
    }

    return res.status(200).json({
      isSuccess: true,
      message: "위시리스트에 추가되었습니다.",
      payload: { bookId },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /wishlist
 * Query:
 *  - page (default 1), size (default 20, max 100)
 *  - sort (default createdAt,DESC) allowed: createdAt
 */
export async function listWishlistController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const page = Math.max(Number(req.query.page ?? 1), 1);
    const size = Math.min(Math.max(Number(req.query.size ?? 20), 1), 100);

    const sortQuery = (req.query.sort as string | undefined) ?? "createdAt,DESC";
    const [rawField = "", rawDir] = sortQuery.split(",");
    const sortDir = rawDir?.toUpperCase() === "ASC" ? "asc" : "desc";

    // whitelist (WishlistItem has createdAt only for sorting usually)
    const sortField = rawField === "createdAt" ? "createdAt" : "createdAt";

    const where = {
      userId: authUser.id,
      // book이 soft delete된 경우는 제외
      book: { deletedAt: null },
    };

    const total = await prisma.wishlistItem.count({ where });

    const items = await prisma.wishlistItem.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { [sortField]: sortDir },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            price: true,
            currency: true,
            coverUrl: true,
            avgRating: true,
            reviewCount: true,
          },
        },
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        content: items.map((w) => ({
          bookId: w.book.id,
          addedAt: w.createdAt,
          book: w.book,
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

/**
 * DELETE /wishlist/:bookId
 * - 위시리스트 삭제
 * - idempotent: 없어도 성공 처리
 */
export async function removeFromWishlistController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const bookId = parseId(req.params.bookId, "bookId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    await prisma.wishlistItem.deleteMany({
      where: { userId: authUser.id, bookId },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "위시리스트에서 삭제되었습니다.",
      payload: { bookId },
    });
  } catch (err) {
    next(err);
  }
}
