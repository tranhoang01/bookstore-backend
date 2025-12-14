/**
 * @openapi
 * tags:
 *   - name: Reviews
 *     description: Review APIs
 */

/**
 * @openapi
 * /reviews/top:
 *   get:
 *     tags: [Reviews]
 *     summary: Top-N 리뷰 조회 (캐시 고려)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "likeCount,DESC" }
 *     responses:
 *       200:
 *         description: OK
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /reviews/books/{bookId}:
 *   get:
 *     tags: [Reviews]
 *     summary: 특정 도서 리뷰 목록
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer, example: 1 }
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
 *       404:
 *         description: Book not found
 *       500:
 *         description: Server error
 *
 *   post:
 *     tags: [Reviews]
 *     summary: 리뷰 작성
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             rating: 5
 *             title: "좋아요"
 *             content: "정말 유익합니다."
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Duplicate review
 *       422:
 *         description: Logical error (e.g., deleted book)
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /reviews/{id}:
 *   patch:
 *     tags: [Reviews]
 *     summary: 리뷰 수정 (작성자)
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
 *           example:
 *             rating: 4
 *             content: "수정된 내용"
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *
 *   delete:
 *     tags: [Reviews]
 *     summary: 리뷰 삭제 (작성자, soft delete)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /reviews/{id}/like:
 *   post:
 *     tags: [Reviews]
 *     summary: 리뷰 좋아요 등록
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 *   delete:
 *     tags: [Reviews]
 *     summary: 리뷰 좋아요 취소
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

// src/modules/reviews/review.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  createReviewForBookController,
  deleteReviewController,
  getTopReviewsController,
  listReviewsForBookController,
  likeReviewController,
  unlikeReviewController,
  updateReviewController,
} from "./review.controller";

export const reviewRouter = Router();

// Top-N (public)
reviewRouter.get("/top", getTopReviewsController);

// Review detail actions (login required for mutating)
reviewRouter.patch("/:id", auth(), updateReviewController);
reviewRouter.delete("/:id", auth(), deleteReviewController);
reviewRouter.post("/:id/like", auth(), likeReviewController);
reviewRouter.delete("/:id/like", auth(), unlikeReviewController);

// Sub-resource under books
reviewRouter.get("/books/:bookId", listReviewsForBookController);          // GET /reviews/books/:bookId
reviewRouter.post("/books/:bookId", auth(), createReviewForBookController); // POST /reviews/books/:bookId
