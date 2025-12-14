// src/modules/orders/order.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

function parseId(param?: string, name = "ID") {
  if (!param) throw new ApiError(400, "BAD_REQUEST", `${name}가 필요합니다.`);
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "BAD_REQUEST", `유효하지 않은 ${name} 입니다.`);
  }
  return id;
}

/**
 * POST /orders
 * - ACTIVE cart를 주문으로 변환 (checkout)
 * - 재고 체크 + 재고 감소
 * - Cart.status -> CHECKED_OUT
 * - Order 생성 + OrderItem 복사
 *
 * NOTE: OrderItem에 bookTitleSnapshot 필수 → Book.title을 snapshot으로 저장
 */
export async function createOrderFromCartController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const payload = await prisma.$transaction(async (tx) => {
      // 1) ACTIVE cart 찾기 (없으면 에러)
      const cart = await tx.cart.findFirst({
        where: { userId: authUser.id, status: "ACTIVE" },
        select: { id: true, userId: true, status: true },
      });

      if (!cart) {
        throw new ApiError(404, "RESOURCE_NOT_FOUND", "ACTIVE 장바구니가 없습니다.");
      }

      // 2) cart items 조회 (+ book info)
      const cartItems = await tx.cartItem.findMany({
        where: { cartId: cart.id },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              price: true,
              stock: true,
              deletedAt: true,
            },
          },
        },
      });

      if (cartItems.length === 0) {
        throw new ApiError(422, "UNPROCESSABLE_ENTITY", "장바구니가 비어 있습니다.");
      }

      // 3) 검증: 삭제된 도서/재고 부족
      for (const it of cartItems) {
        if (it.book.deletedAt) {
          throw new ApiError(
            422,
            "UNPROCESSABLE_ENTITY",
            "삭제된 도서가 포함되어 있습니다.",
            { bookId: it.bookId }
          );
        }
        if (it.book.stock < it.quantity) {
          throw new ApiError(422, "UNPROCESSABLE_ENTITY", "재고가 부족합니다.", {
            bookId: it.bookId,
            stock: it.book.stock,
            requested: it.quantity,
          });
        }
      }

      // 4) totalAmount 계산 (CartItem.unitPrice 사용)
      const totalAmount = cartItems.reduce(
        (sum, it) => sum + Number(it.unitPrice) * it.quantity,
        0
      );

      // 5) Order 생성 (cartId unique)
      const order = await tx.order.create({
        data: {
          userId: authUser.id,
          cartId: cart.id,
          status: "PENDING",
          paymentStatus: "UNPAID",
          totalAmount: totalAmount as any,
          placedAt: new Date(),
        },
        select: { id: true, createdAt: true, placedAt: true },
      });

      // 6) OrderItem 생성 + 재고 감소
      for (const it of cartItems) {
        // bookTitleSnapshot 필수
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            bookId: it.bookId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            bookTitleSnapshot: it.book.title, // ✅ FIX
          } as any, // snapshot 필드가 더 있을 수 있어 any로 안전 처리
        });

        await tx.book.update({
          where: { id: it.bookId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      // 7) Cart 상태 변경
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: "CHECKED_OUT" },
      });

      return {
        orderId: order.id,
        createdAt: order.createdAt,
      };
    });

    return res.status(201).json({
      isSuccess: true,
      message: "주문이 정상적으로 생성되었습니다.",
      payload,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /orders
 * - 내 주문 목록
 * Query:
 *  - page(default 1), size(default 20, max 100)
 *  - sort(default createdAt,DESC) allowed: createdAt, totalAmount, status
 */
export async function listOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const page = Math.max(Number(req.query.page ?? 1), 1);
    const size = Math.min(Math.max(Number(req.query.size ?? 20), 1), 100);

    const sortQuery = (req.query.sort as string | undefined) ?? "createdAt,DESC";
    const [rawField = "", rawDir] = sortQuery.split(",");
    const sortDir = rawDir?.toUpperCase() === "ASC" ? "asc" : "desc";

    const allowed = ["createdAt", "totalAmount", "status"] as const;
    type SortField = (typeof allowed)[number];

    const sortField: SortField = (allowed as readonly string[]).includes(rawField)
      ? (rawField as SortField)
      : "createdAt";

    const where = { userId: authUser.id };

    const total = await prisma.order.count({ where });

    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { [sortField]: sortDir },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        placedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        content: orders,
        page: page - 1,
        size,
        totalElements: total,
        totalPages: Math.ceil(total / size),
        sort: `${sortField},${sortDir.toUpperCase()}`,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /orders/:id
 * - 주문 상세 + items
 * - 본인 주문만 조회 가능
 *
 * NOTE: OrderItem에 snapshot 필드가 있으므로, 상세에서는 snapshot 중심으로 응답해도 됨.
 */
export async function getOrderDetailController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const orderId = parseId(req.params.id, "orderId");

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: authUser.id },
      include: {
        items: {
          // book relation이 있다면 include 가능, 없다면 snapshot으로만 보여도 됨
          include: {
            book: { select: { id: true, coverUrl: true } },
          },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        placedAt: order.placedAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((it: any) => ({
          bookId: it.bookId,
          bookTitle: it.bookTitleSnapshot ?? it.book?.title ?? null,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: Number(it.unitPrice) * it.quantity,
          book: it.book ? { id: it.book.id, coverUrl: it.book.coverUrl } : null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}
