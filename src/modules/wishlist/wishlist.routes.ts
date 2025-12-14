/**
 * @openapi
 * tags:
 *   - name: Wishlist
 *     description: Wishlist APIs
 */

/**
 * @openapi
 * /wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: 위시리스트 목록 조회
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, example: 20 }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 */

/**
 * @openapi
 * /wishlist/{bookId}:
 *   post:
 *     tags: [Wishlist]
 *     summary: 위시리스트 추가
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK (idempotent)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *
 *   delete:
 *     tags: [Wishlist]
 *     summary: 위시리스트 삭제
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK (idempotent)
 */

// src/modules/wishlist/wishlist.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  addToWishlistController,
  listWishlistController,
  removeFromWishlistController,
} from "./wishlist.controller";

export const wishlistRouter = Router();

// login required
wishlistRouter.post("/:bookId", auth(), addToWishlistController);
wishlistRouter.get("/", auth(), listWishlistController);
wishlistRouter.delete("/:bookId", auth(), removeFromWishlistController);
