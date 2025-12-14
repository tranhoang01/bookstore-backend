/**
 * @openapi
 * tags:
 *   - name: Orders
 *     description: Order APIs
 */

/**
 * @openapi
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: 주문 생성 (ACTIVE cart checkout)
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "주문이 정상적으로 생성되었습니다."
 *               payload:
 *                 orderId: 2
 *                 createdAt: "2025-09-15T22:06:37.773Z"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No ACTIVE cart
 *       422:
 *         description: Empty cart / stock issue
 *       500:
 *         description: Server error
 *
 *   get:
 *     tags: [Orders]
 *     summary: 내 주문 목록 조회
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
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: 주문 상세 조회
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
 *         description: Not found (or not your order)
 *       500:
 *         description: Server error
 */

// src/modules/orders/order.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  createOrderFromCartController,
  getOrderDetailController,
  listOrdersController,
} from "./order.controller";

export const orderRouter = Router();

orderRouter.post("/", auth(), createOrderFromCartController);
orderRouter.get("/", auth(), listOrdersController);
orderRouter.get("/:id", auth(), getOrderDetailController);
