/**
 * @openapi
 * tags:
 *   - name: Stats
 *     description: Admin statistics APIs
 */

/**
 * @openapi
 * /stats/top-books:
 *   get:
 *     tags: [Stats]
 *     summary: Top books stats (ADMIN)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /stats/daily:
 *   get:
 *     tags: [Stats]
 *     summary: Daily stats (ADMIN)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, example: "2025-12-01" }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, example: "2025-12-13" }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

// src/modules/stats/stats.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import { dailyStatsController, topBooksController } from "./stats.controller";

export const statsRouter = Router();

// ADMIN only
statsRouter.get("/top-books", auth(["ADMIN"]), topBooksController);
statsRouter.get("/daily", auth(["ADMIN"]), dailyStatsController);
