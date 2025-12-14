// src/modules/auth/auth.service.ts
import bcrypt from "bcrypt";
import jwt, { JwtPayload as JwtPayloadBase, Secret } from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

const ACCESS_SECRET: Secret = (process.env.JWT_ACCESS_SECRET || "") as Secret;
const REFRESH_SECRET: Secret = (process.env.JWT_REFRESH_SECRET || "") as Secret;

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  console.warn(
    "[Auth] JWT_ACCESS_SECRET or JWT_REFRESH_SECRET is not set. Please configure them in .env"
  );
}

// Type for decoded refresh token (based on jsonwebtoken's JwtPayload)
type DecodedRefreshToken = JwtPayloadBase & {
  sub: number;
  role?: string;
  type?: string;
};

// 간단한 해시 함수: refreshToken 원문을 DB에 그대로 저장하지 않고 해시로만 저장
// Simple hash function to store only hash of refresh token in DB
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Access Token 생성
// Generate Access Token
function generateAccessToken(user: { id: number; role: string }) {
  const payload = {
    sub: user.id,
    role: user.role,
    type: "access" as const,
  };

  return (jwt as any).sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  }) as string;
}

// Refresh Token 생성 + DB 저장 (token rotation 고려)
// Generate refresh token and store hash in DB
async function generateAndStoreRefreshToken(args: {
  userId: number;
  role: string;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const payload = {
    sub: args.userId,
    role: args.role,
    type: "refresh" as const,
  };

  const refreshToken = (jwt as any).sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  }) as string;

  // decode for expiresAt
  const decoded = jwt.decode(refreshToken) as JwtPayloadBase | null;
  const expiresAt =
    decoded?.exp != null ? new Date(decoded.exp * 1000) : new Date();

  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: args.userId,
      tokenHash,
      userAgent: args.userAgent, // String? => string | null
      ipAddress: args.ipAddress, // String? => string | null
      expiresAt,
      revoked: false,
    },
  });

  return refreshToken;
}

/**
 * 회원가입 서비스
 * Sign up service
 */
export async function signupService(params: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}) {
  const { email, password, name, phone } = params;

  if (!email || !password || !name) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "email, password, name 은(는) 필수입니다.",
      { email: !!email, password: !!password, name: !!name }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(
      409,
      "DUPLICATE_RESOURCE",
      "이미 사용 중인 이메일입니다.",
      { email }
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: phone ?? null, // 🔥 fix: string | undefined -> string | null
      role: "CUSTOMER",
    },
  });

  // 회원가입만 처리, 로그인은 /auth/login 에서 토큰 발급
  // Only sign up here; login issues tokens in /auth/login

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/**
 * 로그인 서비스
 * Login service (returns access + refresh token)
 */
export async function loginService(params: {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const { email, password, userAgent, ipAddress } = params;

  if (!email || !password) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "email, password 은(는) 필수입니다.",
      { email: !!email, password: !!password }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "이메일 또는 비밀번호가 올바르지 않습니다."
    );
  }
  if (user.deletedAt) {
  throw new ApiError(403, "FORBIDDEN", "탈퇴 처리된 계정입니다.");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "이메일 또는 비밀번호가 올바르지 않습니다."
    );
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateAndStoreRefreshToken({
    userId: user.id,
    role: user.role,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

/**
 * 토큰 갱신 서비스
 * Refresh token service (rotation)
 */
export async function refreshTokenService(params: {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const { refreshToken, userAgent, ipAddress } = params;

  if (!refreshToken) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "refreshToken 은(는) 필수입니다."
    );
  }

  let decoded: DecodedRefreshToken;
  try {
    decoded = jwt.verify(refreshToken, REFRESH_SECRET) as DecodedRefreshToken;
  } catch (err: any) {
    const code =
      err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
    throw new ApiError(
      401,
      code,
      code === "TOKEN_EXPIRED"
        ? "리프레시 토큰이 만료되었습니다."
        : "유효하지 않은 리프레시 토큰입니다."
    );
  }

  if (decoded.type !== "refresh") {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "리프레시 토큰 타입이 올바르지 않습니다."
    );
  }

  const tokenHash = hashToken(refreshToken);

  const stored = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revoked: false,
    },
  });

  if (!stored) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "리프레시 토큰이 유효하지 않습니다."
    );
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });
    throw new ApiError(
      401,
      "TOKEN_EXPIRED",
      "리프레시 토큰이 만료되었습니다."
    );
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  }
  if (user.deletedAt) {
  throw new ApiError(403, "FORBIDDEN", "탈퇴 처리된 계정입니다.");
  }

  // Token rotation: revoke old token and issue new one
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  const accessToken = generateAccessToken(user);
  const newRefreshToken = await generateAndStoreRefreshToken({
    userId: user.id,
    role: user.role,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * 로그아웃 서비스
 * Logout service (revoke refresh token)
 */
export async function logoutService(params: { refreshToken: string }) {
  const { refreshToken } = params;

  if (!refreshToken) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "refreshToken 은(는) 필수입니다."
    );
  }

  const tokenHash = hashToken(refreshToken);

  // 토큰이 DB에 없더라도, 보안상 OK 응답 (idempotent)
  // Even if token not found, respond OK (idempotent logout)
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revoked: false,
    },
    data: { revoked: true },
  });

  return;
}
