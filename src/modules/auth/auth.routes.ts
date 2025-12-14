/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication APIs
 */

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: 회원가입
 *     description: bcrypt로 비밀번호 해시 후 사용자 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: "user1@example.com"
 *             password: "P@ssw0rd!"
 *             name: "User One"
 *             phone: "010-1234-5678"
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "회원가입 성공"
 *               payload:
 *                 userId: 1
 *                 createdAt: "2025-12-13T00:00:00Z"
 *       409:
 *         description: Duplicate email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               timestamp: "2025-03-05T12:34:56Z"
 *               path: "/auth/signup"
 *               status: 409
 *               code: "DUPLICATE_RESOURCE"
 *               message: "이미 존재하는 이메일입니다."
 *               details: { email: "user1@example.com" }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               timestamp: "2025-03-05T12:34:56Z"
 *               path: "/auth/signup"
 *               status: 400
 *               code: "VALIDATION_FAILED"
 *               message: "필드 유효성 검사 실패"
 *               details: { password: "too short" }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 로그인
 *     description: 이메일/비밀번호 확인 후 JWT 발급 (access/refresh)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "로그인 성공"
 *               payload:
 *                 accessToken: "eyJhbGciOi..."
 *                 refreshToken: "eyJhbGciOi..."
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               timestamp: "2025-03-05T12:34:56Z"
 *               path: "/auth/login"
 *               status: 401
 *               code: "UNAUTHORIZED"
 *               message: "이메일 또는 비밀번호가 올바르지 않습니다."
 *               details: null
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: 토큰 갱신
 *     description: RefreshToken 테이블 기반으로 access token 재발급
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             refreshToken: "eyJhbGciOi..."
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "토큰 갱신 성공"
 *               payload:
 *                 accessToken: "eyJhbGciOi..."
 *       401:
 *         description: Token expired/invalid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               timestamp: "2025-03-05T12:34:56Z"
 *               path: "/auth/refresh"
 *               status: 401
 *               code: "TOKEN_EXPIRED"
 *               message: "토큰 만료"
 *               details: null
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: 로그아웃
 *     description: RefreshToken 삭제/폐기 처리
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             refreshToken: "eyJhbGciOi..."
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "로그아웃 성공"
 *               payload: null
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

// src/modules/auth/auth.routes.ts
import { Router } from "express";
import {
  loginController,
  logoutController,
  refreshTokenController,
  signupController,
} from "./auth.controller";

export const authRouter = Router();

/**
 * @route POST /auth/signup
 * @desc 회원가입 (Sign up)
 */
authRouter.post("/signup", signupController);

/**
 * @route POST /auth/login
 * @desc 로그인 (Login)
 */
authRouter.post("/login", loginController);

/**
 * @route POST /auth/refresh
 * @desc 토큰 갱신 (Refresh access & refresh token)
 */
authRouter.post("/refresh", refreshTokenController);

/**
 * @route POST /auth/logout
 * @desc 로그아웃 (Revoke refresh token)
 */
authRouter.post("/logout", logoutController);
