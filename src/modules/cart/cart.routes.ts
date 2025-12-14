/**
 * @openapi
 * tags:
 *   - name: Cart
 *     description: Cart APIs
 */

/**
 * @openapi
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: 장바구니 목록 조회 (ACTIVE cart)
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
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: 장바구니 담기
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { bookId: 1, quantity: 2 }
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *       422:
 *         description: Not enough stock
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /cart/items/{bookId}:
 *   patch:
 *     tags: [Cart]
 *     summary: 장바구니 수량 변경
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
 *           example: { quantity: 5 }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cart item not found
 *       422:
 *         description: Not enough stock
 *
 *   delete:
 *     tags: [Cart]
 *     summary: 장바구니에서 삭제
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
 */

// src/modules/cart/cart.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  addCartItemController,
  listCartController,
  removeCartItemController,
  updateCartItemController,
} from "./cart.controller";

export const cartRouter = Router();

cartRouter.get("/", auth(), listCartController);
cartRouter.post("/items", auth(), addCartItemController);
cartRouter.patch("/items/:bookId", auth(), updateCartItemController);
cartRouter.delete("/items/:bookId", auth(), removeCartItemController);
