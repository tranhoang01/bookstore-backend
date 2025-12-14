// src/modules/users/admin.user.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

/**
 * GET /users (ADMIN)
 */
export async function adminListUsersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const size = Math.min(Math.max(Number(req.query.size ?? 20), 1), 100);

    // ===== SORT FIX =====
    const ALLOWED_SORT_FIELDS = [
      "id",
      "email",
      "name",
      "role",
      "createdAt",
      "updatedAt",
    ] as const;

    type UserSortField = typeof ALLOWED_SORT_FIELDS[number];

    const sortQuery = (req.query.sort as string | undefined) ?? "createdAt,DESC";
    const [rawField, rawDir] = sortQuery.split(",");

    const sortField: UserSortField = ALLOWED_SORT_FIELDS.includes(
      rawField as UserSortField
    )
      ? (rawField as UserSortField)
      : "createdAt";

    const sortDir = rawDir?.toUpperCase() === "ASC" ? "asc" : "desc";
    // ====================

    const keyword = ((req.query.keyword as string) || "").trim();
    const role = req.query.role as string | undefined;
    const includeDeleted = req.query.includeDeleted === "true";

    const where: any = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (keyword) {
      where.OR = [
        { email: { contains: keyword, mode: "insensitive" } },
        { name: { contains: keyword, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const total = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: {
        [sortField]: sortDir,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        content: users,
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
 * PATCH /users/:id/deactivate (ADMIN)
 */
export async function adminDeactivateUserController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // ===== ID FIX =====
    const idParam = req.params.id;

    if (!idParam) {
      throw new ApiError(400, "BAD_REQUEST", "사용자 ID가 필요합니다.");
    }

    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(400, "BAD_REQUEST", "유효하지 않은 사용자 ID 입니다.");
    }
    // =================

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    }

    if (user.deletedAt) {
      return res.status(200).json({
        isSuccess: true,
        message: "이미 비활성화된 사용자입니다.",
        payload: {
          userId: user.id,
          deletedAt: user.deletedAt,
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "사용자가 비활성화되었습니다.",
      payload: updated,
    });
  } catch (err) {
    next(err);
  }
}
