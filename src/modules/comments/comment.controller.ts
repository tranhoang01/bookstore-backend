// src/modules/comments/comment.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

// ---------- helper ----------
function parseId(param?: string, name = "ID") {
  if (!param) throw new ApiError(400, "BAD_REQUEST", `${name}가 필요합니다.`);
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "BAD_REQUEST", `유효하지 않은 ${name} 입니다.`);
  }
  return id;
}

// ---------- GET /comments/reviews/:reviewId ----------
export async function listCommentsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewId = parseId(req.params.reviewId, "reviewId");

    const comments = await prisma.comment.findMany({
      where: { reviewId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: comments.map((c) => ({
        id: c.id,
        content: c.content,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: c.user,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ---------- POST /comments/reviews/:reviewId ----------
export async function createCommentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewId = parseId(req.params.reviewId, "reviewId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length < 1) {
      throw new ApiError(400, "VALIDATION_FAILED", "content 는 필수입니다.");
    }

    const review = await prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true },
    });
    if (!review) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "리뷰를 찾을 수 없습니다.");
    }

    const created = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: authUser.id,
        reviewId,
      },
      select: { id: true, createdAt: true },
    });

    // 댓글 수 증가
    await prisma.review.update({
      where: { id: reviewId },
      data: { commentCount: { increment: 1 } },
    });

    return res.status(201).json({
      isSuccess: true,
      message: "댓글이 작성되었습니다.",
      payload: created,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- PATCH /comments/:id ----------
export async function updateCommentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const commentId = parseId(req.params.id, "commentId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length < 1) {
      throw new ApiError(400, "VALIDATION_FAILED", "content 값이 올바르지 않습니다.");
    }

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "댓글을 찾을 수 없습니다.");
    }
    if (existing.userId !== authUser.id) {
      throw new ApiError(403, "FORBIDDEN", "댓글 수정 권한이 없습니다.");
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      select: { id: true, updatedAt: true },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "댓글이 수정되었습니다.",
      payload: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- DELETE /comments/:id ----------
export async function deleteCommentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const commentId = parseId(req.params.id, "commentId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, reviewId: true, deletedAt: true },
    });

    if (!existing) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "댓글을 찾을 수 없습니다.");
    }
    if (existing.userId !== authUser.id) {
      throw new ApiError(403, "FORBIDDEN", "댓글 삭제 권한이 없습니다.");
    }
    if (existing.deletedAt) {
      return res.status(200).json({
        isSuccess: true,
        message: "이미 삭제된 댓글입니다.",
        payload: { commentId, deletedAt: existing.deletedAt },
      });
    }

    const deleted = await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    await prisma.review.update({
      where: { id: existing.reviewId },
      data: { commentCount: { decrement: 1 } },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "댓글이 삭제 처리되었습니다.",
      payload: deleted,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- POST /comments/:id/like ----------
export async function likeCommentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const commentId = parseId(req.params.id, "commentId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    await prisma.$transaction(async (tx) => {
      const exists = await tx.commentLike.findUnique({
        where: { userId_commentId: { userId: authUser.id, commentId } },
      });
      if (exists) return;

      await tx.commentLike.create({
        data: { userId: authUser.id, commentId },
      });

      await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      });
    });

    return res.status(200).json({
      isSuccess: true,
      message: "댓글 좋아요 등록",
      payload: null,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- DELETE /comments/:id/like ----------
export async function unlikeCommentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const commentId = parseId(req.params.id, "commentId");
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    await prisma.$transaction(async (tx) => {
      const exists = await tx.commentLike.findUnique({
        where: { userId_commentId: { userId: authUser.id, commentId } },
      });
      if (!exists) return;

      await tx.commentLike.delete({
        where: { userId_commentId: { userId: authUser.id, commentId } },
      });

      await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      });
    });

    return res.status(200).json({
      isSuccess: true,
      message: "댓글 좋아요 취소",
      payload: null,
    });
  } catch (err) {
    next(err);
  }
}
