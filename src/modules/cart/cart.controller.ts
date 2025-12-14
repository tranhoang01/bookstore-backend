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

function parseQuantity(value: any) {
  const q = Number(value);
  if (!Number.isInteger(q) || q < 1 || q > 999) {
    throw new ApiError(400, "VALIDATION_FAILED", "quantity 는 1~999 범위의 정수여야 합니다.");
  }
  return q;
}

/** ACTIVE cart 가져오기 (없으면 생성) */
async function getOrCreateActiveCart(userId: number) {
  const cart = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, userId: true, status: true, createdAt: true },
  });

  if (cart) return cart;

  return prisma.cart.create({
    data: { userId, status: "ACTIVE" },
    select: { id: true, userId: true, status: true, createdAt: true },
  });
}

/**
 * GET /cart
 * - ACTIVE cart의 items 목록 조회
 * Query: page, size
 */
export async function listCartController(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const page = Math.max(Number(req.query.page ?? 1), 1);
    const size = Math.min(Math.max(Number(req.query.size ?? 20), 1), 100);

    const cart = await getOrCreateActiveCart(authUser.id);

    const where = {
      cartId: cart.id,
      book: { deletedAt: null },
    };

    const total = await prisma.cartItem.count({ where });

    const items = await prisma.cartItem.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: "desc" },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            price: true,
            currency: true,
            coverUrl: true,
            stock: true,
          },
        },
      },
    });

    const subtotal = items.reduce((sum, it) => sum + Number(it.unitPrice) * it.quantity, 0);

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        cart: { id: cart.id, status: cart.status, createdAt: cart.createdAt },
        content: items.map((it) => ({
          bookId: it.book.id,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: Number(it.unitPrice) * it.quantity,
          addedAt: it.createdAt,
          updatedAt: it.updatedAt,
          book: it.book,
        })),
        summary: {
          subtotal,
          currency: items[0]?.book.currency ?? "KRW",
        },
        page: page - 1,
        size,
        totalElements: total,
        totalPages: Math.ceil(total / size),
        sort: "createdAt,DESC",
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /cart/items
 * Body: { bookId, quantity }
 * - 이미 있으면 quantity 증가
 * - unitPrice는 book.price로 저장 (추후 가격 변동 대비)
 */
export async function addCartItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const { bookId, quantity } = req.body as { bookId: number; quantity: number };
    const bId = parseId(String(bookId), "bookId");
    const q = parseQuantity(quantity);

    const cart = await getOrCreateActiveCart(authUser.id);

    const book = await prisma.book.findFirst({
      where: { id: bId, deletedAt: null },
      select: { id: true, stock: true, price: true, currency: true },
    });
    if (!book) throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    if (book.stock < q) {
      throw new ApiError(422, "UNPROCESSABLE_ENTITY", "재고가 부족합니다.", {
        stock: book.stock,
        requested: q,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_bookId: { cartId: cart.id, bookId: bId } }, // ✅ key 이름이 cartId_bookId
        select: { quantity: true },
      });

      if (!existing) {
        return tx.cartItem.create({
          data: {
            cartId: cart.id,
            bookId: bId,
            quantity: q,
            unitPrice: book.price, // ✅ 필수
          },
          select: { bookId: true, quantity: true, unitPrice: true, updatedAt: true },
        });
      }

      const newQty = existing.quantity + q;
      if (newQty > book.stock) {
        throw new ApiError(422, "UNPROCESSABLE_ENTITY", "재고를 초과하여 담을 수 없습니다.", {
          stock: book.stock,
        });
      }

      return tx.cartItem.update({
        where: { cartId_bookId: { cartId: cart.id, bookId: bId } },
        data: { quantity: newQty },
        select: { bookId: true, quantity: true, unitPrice: true, updatedAt: true },
      });
    });

    return res.status(201).json({
      isSuccess: true,
      message: "장바구니에 담았습니다.",
      payload: {
        cartId: cart.id,
        bookId: result.bookId,
        quantity: result.quantity,
        unitPrice: result.unitPrice,
        updatedAt: result.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /cart/items/:bookId
 * Body: { quantity }
 * - 수량을 특정 값으로 변경
 */
export async function updateCartItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const bId = parseId(req.params.bookId, "bookId");
    const { quantity } = req.body as { quantity: number };
    const q = parseQuantity(quantity);

    const cart = await getOrCreateActiveCart(authUser.id);

    const book = await prisma.book.findFirst({
      where: { id: bId, deletedAt: null },
      select: { id: true, stock: true },
    });
    if (!book) throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    if (book.stock < q) {
      throw new ApiError(422, "UNPROCESSABLE_ENTITY", "재고가 부족합니다.", {
        stock: book.stock,
        requested: q,
      });
    }

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_bookId: { cartId: cart.id, bookId: bId } },
      select: { bookId: true },
    });
    if (!existing) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "장바구니 항목이 없습니다.");
    }

    const updated = await prisma.cartItem.update({
      where: { cartId_bookId: { cartId: cart.id, bookId: bId } },
      data: { quantity: q },
      select: { bookId: true, quantity: true, unitPrice: true, updatedAt: true },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "장바구니 수량이 수정되었습니다.",
      payload: { cartId: cart.id, ...updated },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /cart/items/:bookId
 * - 장바구니에서 항목 삭제 (idempotent)
 */
export async function removeCartItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as any).user as { id: number } | undefined;
    if (!authUser) throw new ApiError(401, "UNAUTHORIZED", "인증 필요");

    const bId = parseId(req.params.bookId, "bookId");
    const cart = await getOrCreateActiveCart(authUser.id);

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, bookId: bId },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "장바구니에서 삭제되었습니다.",
      payload: { cartId: cart.id, bookId: bId },
    });
  } catch (err) {
    next(err);
  }
}
