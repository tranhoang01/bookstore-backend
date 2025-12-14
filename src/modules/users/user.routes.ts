/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: User profile & admin APIs
 */

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: 내 프로필 조회
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "성공"
 *               payload:
 *                 id: 1
 *                 email: "user1@example.com"
 *                 name: "User One"
 *                 phone: "010-1234-5678"
 *                 role: "USER"
 *                 createdAt: "2025-12-13T00:00:00Z"
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
 *
 *   patch:
 *     tags: [Users]
 *     summary: 내 프로필 수정 (name/phone/password)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "New Name"
 *             phone: "010-2222-3333"
 *             password: "N3wP@ssw0rd!"
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "수정되었습니다."
 *               payload:
 *                 updatedAt: "2025-12-13T00:10:00Z"
 *       400:
 *         description: Validation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 *
 *   delete:
 *     tags: [Users]
 *     summary: 회원 탈퇴 (soft delete)
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "삭제 처리되었습니다."
 *               payload:
 *                 deletedAt: "2025-12-13T00:20:00Z"
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

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: 사용자 목록 조회 (ADMIN)
 *     description: ADMIN 권한 필요
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, example: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "createdAt,DESC" }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Forbidden (Role mismatch)
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
 * /users/{id}/deactivate:
 *   patch:
 *     tags: [Users]
 *     summary: 사용자 비활성화 (ADMIN)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

// src/modules/users/user.routes.ts
import { Router } from "express";
import { getMeController, updateMeController, deleteMeController } from "./user.controller";
import { auth } from "../../middlewares/auth";
import { adminListUsersController, adminDeactivateUserController } from "./admin.user.controller";

export const userRouter = Router();

/**
 * @route GET /users/me
 * @desc 내 프로필 조회 (Get my profile)
 * @access 로그인 필요 (Requires login)
 */
userRouter.get("/me", auth(), getMeController);
userRouter.patch("/me", auth(), updateMeController);
userRouter.delete("/me", auth(), deleteMeController);

// admin endpoints (ADMIN only)
userRouter.get("/", auth(["ADMIN"]), adminListUsersController);
userRouter.patch("/:id/deactivate", auth(["ADMIN"]), adminDeactivateUserController);
