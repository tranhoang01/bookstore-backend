// src/modules/users/user.controller.ts
import bcrypt from "bcrypt";
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

/**
 * GET /users/me
 * - Lấy thông tin user từ JWT (req.user.id)
 * - Trả về profile cơ bản
 *
 * 🇻🇳: Chỉ truy cập được khi gửi kèm accessToken hợp lệ trong header.
 * 🇰🇷: Authorization: Bearer <accessToken> 이 필요합니다.
 */
export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number; role: string } | undefined;

    if (!authUser) {
      // theoretically, this shouldn't happen if auth() is correctly used
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "인증 정보가 없습니다."
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    }

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /users/me
 * - name/phone/password 수정
 * - password 변경 시 bcrypt 해시 저장
 */
export async function updateMeController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number; role: string } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    const { name, phone, password } = req.body as {
      name?: string;
      phone?: string;
      password?: string;
    };

    // 최소 1개는 들어와야 함
    if (name == null && phone == null && password == null) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "수정할 필드가 없습니다. (name/phone/password 중 최소 1개 필요)",
        { name, phone, password: password ? true : false }
      );
    }

    // 간단 검증 (필요하면 더 강하게)
    const details: any = {};
    if (name != null && (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 50)) {
      details.name = "name length must be 1~50";
    }
    if (phone != null && (typeof phone !== "string" || phone.length > 20)) {
      details.phone = "phone must be a string (max 20)";
    }
    if (password != null && (typeof password !== "string" || password.length < 8)) {
      details.password = "password must be at least 8 characters";
    }
    if (Object.keys(details).length > 0) {
      throw new ApiError(400, "VALIDATION_FAILED", "유효성 검사 실패", details);
    }

    // deleted user check
    const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!existing || existing.deletedAt) {
      throw new ApiError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    }

    const dataToUpdate: any = {};
    if (name != null) dataToUpdate.name = name.trim();
    if (phone != null) dataToUpdate.phone = phone;
    if (password != null) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    const updated = await prisma.user.update({
      where: { id: authUser.id },
      data: dataToUpdate,
    });

    return res.status(200).json({
      isSuccess: true,
      message: "프로필이 수정되었습니다.",
      payload: {
        userId: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        role: updated.role,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /users/me
 * - soft delete: deletedAt 세팅 + 계정 비활성화
 * - role을 CUSTOMER로 유지해도 되지만, 여기서는 SECURITY 위해 토큰/세션과 별개로 계정 비활성화 표시만 함
 */
export async function deleteMeController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number; role: string } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 정보가 없습니다.");

    const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!existing || existing.deletedAt) {
      // 이미 삭제된 경우도 idempotent하게 200 처리 가능.
      // 과제 기준엔 409/404도 가능하지만, 실무형으로는 200도 흔함.
      return res.status(200).json({
        isSuccess: true,
        message: "이미 탈퇴 처리된 계정입니다.",
        payload: null,
      });
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        deletedAt: new Date(),
        // 선택: 개인정보 최소화(원하면 활성화)
        // phone: null,
        // name: "탈퇴회원",
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "계정이 탈퇴 처리되었습니다.",
      payload: null,
    });
  } catch (err) {
    next(err);
  }
}
