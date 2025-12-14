/**
 * @openapi
 * tags:
 *   - name: Comments
 *     description: Comment APIs
 */

/**
 * @openapi
 * /comments/reviews/{reviewId}:
 *   get:
 *     tags: [Comments]
 *     summary: 리뷰 댓글 목록
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 *       500:
 *         description: Server error
 *
 *   post:
 *     tags: [Comments]
 *     summary: 댓글 작성
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             content: "댓글 내용입니다."
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /comments/{id}:
 *   patch:
 *     tags: [Comments]
 *     summary: 댓글 수정 (작성자)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { content: "수정된 댓글" }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *
 *   delete:
 *     tags: [Comments]
 *     summary: 댓글 삭제 (작성자, soft delete)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 */

/**
 * @openapi
 * /comments/{id}/like:
 *   post:
 *     tags: [Comments]
 *     summary: 댓글 좋아요 등록
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 *   delete:
 *     tags: [Comments]
 *     summary: 댓글 좋아요 취소
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 */

// src/modules/comments/comment.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  listCommentsController,
  createCommentController,
  updateCommentController,
  deleteCommentController,
  likeCommentController,
  unlikeCommentController,
} from "./comment.controller";

export const commentRouter = Router();

// sub-resource under review
commentRouter.get("/reviews/:reviewId", listCommentsController);
commentRouter.post("/reviews/:reviewId", auth(), createCommentController);

// comment actions
commentRouter.patch("/:id", auth(), updateCommentController);
commentRouter.delete("/:id", auth(), deleteCommentController);

// like
commentRouter.post("/:id/like", auth(), likeCommentController);
commentRouter.delete("/:id/like", auth(), unlikeCommentController);
