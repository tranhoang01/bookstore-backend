// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload as DefaultJwtPayload } from "jsonwebtoken";
import { ApiError } from "../utils/error";

/**
 * ACCESS_SECRET
 * - Lấy từ process.env một lần
 * - Nếu không có thì throw error ngay khi load file
 */
const rawAccessSecret = process.env.JWT_ACCESS_SECRET;

if (!rawAccessSecret) {
  // 서버 시작 시점에 바로 에러를 던져서, 잘못된 환경 설정을 빨리 발견
  throw new Error("JWT_ACCESS_SECRET is not set in environment (.env)");
}

const ACCESS_SECRET: string = rawAccessSecret;

/**
 * AuthJwtPayload
 * - 확장된 JWT payload 타입
 * - jsonwebtoken의 JwtPayload 에 sub, role, type 을 추가
 *
 * 🇻🇳: Dựa trên JwtPayload của thư viện, thêm sub, role, type.
 */
type AuthJwtPayload = DefaultJwtPayload & {
  sub: number; // user id
  role: "CUSTOMER" | "ADMIN";
  type?: "access" | "refresh";
};

/**
 * Authorization 헤더에서 Bearer 토큰을 안전하게 추출
 * Safely extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string {
  if (!authHeader) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "인증 토큰이 필요합니다.",
      { authorization: null }
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Authorization 헤더 형식이 올바르지 않습니다. (예: 'Bearer <token>')",
      { authorization: authHeader }
    );
  }

  const parts = authHeader.split(" ");
  if (parts.length < 2 || !parts[1]) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Authorization 헤더에서 토큰을 찾을 수 없습니다.",
      { authorization: authHeader }
    );
  }

  return parts[1]; // 여기서는 항상 string
}

/**
 * auth()
 * - Kiểm tra JWT Access Token trong header Authorization
 * - Gắn thông tin user { id, role } vào req
 * - Có thể hạn chế role: auth(["ADMIN"]) → chỉ admin mới vào được
 *
 * 🇻🇳: Dùng cho các API cần đăng nhập (/users/me, /orders, /reviews/create, ...)
 * 🇰🇷: 로그인 필수 API에서 사용하는 인증/인가 미들웨어입니다.
 */
export function auth(requiredRoles?: ("CUSTOMER" | "ADMIN")[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1) Bearer 토큰 추출
      const token = extractBearerToken(req.headers.authorization);

      // 2) JWT 검증
      const decodedRaw = jwt.verify(token, ACCESS_SECRET);

      // jwt.verify()는 string 또는 object를 반환할 수 있으므로 체크 필요
      if (!decodedRaw || typeof decodedRaw === "string") {
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "유효하지 않은 토큰입니다."
        );
      }

      // 여기 도달하면 decodedRaw 는 object 타입
      const decoded = decodedRaw as AuthJwtPayload;

      if (decoded.type && decoded.type !== "access") {
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "access 토큰이 아닙니다."
        );
      }

      if (typeof decoded.sub !== "number" || !decoded.role) {
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "토큰 payload 형식이 올바르지 않습니다."
        );
      }

      // req.user 에 사용자 정보 저장 (타입 단순화를 위해 any)
      (req as any).user = {
        id: decoded.sub,
        role: decoded.role,
      };

      // Role 체크 (RBAC)
      if (requiredRoles && !requiredRoles.includes(decoded.role)) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "해당 리소스에 접근할 권한이 없습니다.",
          { requiredRoles, role: decoded.role }
        );
      }

      next();
    } catch (err: any) {
      if (err instanceof ApiError) {
        return next(err);
      }

      // JWT 에러 처리
      const code =
        err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";

      return next(
        new ApiError(
          401,
          code,
          code === "TOKEN_EXPIRED"
            ? "토큰이 만료되었습니다."
            : "유효하지 않은 토큰입니다."
        )
      );
    }
  };
}
