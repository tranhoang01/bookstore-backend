/**
 * @openapi
 * tags:
 *   - name: Books
 *     description: Book management APIs
 */

/**
 * @openapi
 * /books:
 *   get:
 *     tags: [Books]
 *     summary: 도서 목록 조회 (pagination/sort/filter)
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
 *       - in: query
 *         name: keyword
 *         schema: { type: string, example: "java" }
 *       - in: query
 *         name: category
 *         schema: { type: string, example: "Programming" }
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Invalid query param
 *       500:
 *         description: Server error
 *
 *   post:
 *     tags: [Books]
 *     summary: 도서 등록 (ADMIN)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Clean Code"
 *             price: 30000
 *             authors: ["Robert C. Martin"]
 *             categories: ["Programming"]
 *             stock: 10
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       400:
 *         description: Validation
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /books/{id}:
 *   get:
 *     tags: [Books]
 *     summary: 도서 상세 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *
 *   patch:
 *     tags: [Books]
 *     summary: 도서 수정 (ADMIN)
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
 *             price: 25000
 *             stock: 20
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
 *     tags: [Books]
 *     summary: 도서 삭제 (ADMIN, soft delete)
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

// src/modules/books/book.routes.ts
import { Router } from "express";
import { auth } from "../../middlewares/auth";
import {
  createBookController,
  deleteBookController,
  getBookDetailController,
  listBooksController,
  updateBookController,
} from "./book.controller";

export const bookRouter = Router();

// public
bookRouter.get("/", listBooksController);
bookRouter.get("/:id", getBookDetailController);

// admin only
bookRouter.post("/", auth(["ADMIN"]), createBookController);
bookRouter.patch("/:id", auth(["ADMIN"]), updateBookController);
bookRouter.delete("/:id", auth(["ADMIN"]), deleteBookController);
