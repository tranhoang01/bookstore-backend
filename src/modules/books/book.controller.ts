// src/modules/books/book.controller.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../../db/prisma";
import { ApiError } from "../../utils/error";

// -------------------------
// helpers
// -------------------------
const ALLOWED_SORT_FIELDS = [
  "id",
  "title",
  "price",
  "stock",
  "avgRating",
  "reviewCount",
  "createdAt",
  "updatedAt",
] as const;
type BookSortField = typeof ALLOWED_SORT_FIELDS[number];

function parseId(param?: string) {
  if (!param) throw new ApiError(400, "BAD_REQUEST", "ID가 필요합니다.");
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "BAD_REQUEST", "유효하지 않은 ID 입니다.");
  }
  return id;
}

function parsePagination(req: Request) {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const size = Math.min(Math.max(Number(req.query.size ?? 20), 1), 100);

  const sortQuery = (req.query.sort as string | undefined) ?? "createdAt,DESC";
  const [rawField, rawDir] = sortQuery.split(",");

  const sortField: BookSortField = ALLOWED_SORT_FIELDS.includes(
    rawField as BookSortField
  )
    ? (rawField as BookSortField)
    : "createdAt";

  const sortDir = rawDir?.toUpperCase() === "ASC" ? "asc" : "desc";

  return { page, size, sortField, sortDir };
}

// -------------------------
// GET /books (public)
// -------------------------
/**
 * Query:
 * - page (default 1), size (default 20, max 100)
 * - sort (default createdAt,DESC)
 * - keyword (optional) -> title contains
 * - minPrice/maxPrice (optional)
 * - categoryId (optional)
 * - authorId (optional)
 * - includeDeleted (optional, default false)
 */
export async function listBooksController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { page, size, sortField, sortDir } = parsePagination(req);

    const keyword = ((req.query.keyword as string) || "").trim();
    const includeDeleted = (req.query.includeDeleted as string) === "true";

    const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : null;

    const categoryId =
      req.query.categoryId != null ? Number(req.query.categoryId) : null;
    const authorId =
      req.query.authorId != null ? Number(req.query.authorId) : null;

    const where: any = {};

    if (!includeDeleted) where.deletedAt = null;

    if (keyword) {
      where.title = { contains: keyword, mode: "insensitive" };
    }

    if (minPrice != null || maxPrice != null) {
      where.price = {};
      if (minPrice != null && !Number.isNaN(minPrice)) where.price.gte = minPrice;
      if (maxPrice != null && !Number.isNaN(maxPrice)) where.price.lte = maxPrice;
    }

    // 관계 필터 (category/author)
    if (categoryId != null && !Number.isNaN(categoryId)) {
      where.bookCategories = { some: { categoryId } };
    }
    if (authorId != null && !Number.isNaN(authorId)) {
      where.bookAuthors = { some: { authorId } };
    }

    const total = await prisma.book.count({ where });

    const books = await prisma.book.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { [sortField]: sortDir },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        stock: true,
        avgRating: true,
        reviewCount: true,
        coverUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        content: books,
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

// -------------------------
// GET /books/:id (public)
// -------------------------
export async function getBookDetailController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseId(req.params.id);

    const book = await prisma.book.findFirst({
      where: { id, deletedAt: null },
      include: {
        bookAuthors: {
          include: { author: true },
          orderBy: { authorOrder: "asc" },
        },
        bookCategories: {
          include: { category: true },
        },
      },
    });

    if (!book) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    }

    return res.status(200).json({
      isSuccess: true,
      message: "성공",
      payload: {
        id: book.id,
        title: book.title,
        description: book.description,
        isbn13: book.isbn13,
        price: book.price,
        currency: book.currency,
        stock: book.stock,
        publicationDate: book.publicationDate,
        coverUrl: book.coverUrl,
        format: book.format,
        language: book.language,
        publisher: book.publisher,
        avgRating: book.avgRating,
        reviewCount: book.reviewCount,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        authors: book.bookAuthors.map((ba) => ({
          id: ba.author.id,
          name: ba.author.name,
          bio: ba.author.bio,
          order: ba.authorOrder,
        })),
        categories: book.bookCategories.map((bc) => ({
          id: bc.category.id,
          name: bc.category.name,
          slug: bc.category.slug,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// -------------------------
// POST /books (ADMIN)
// -------------------------
/**
 * Body:
 * {
 *  "title": "Clean Code",
 *  "price": 25000,
 *  "stock": 10,
 *  "isbn13": "9780132350884",
 *  "description": "...",
 *  "authors": ["Robert C. Martin", "Someone Else"],
 *  "categories": ["programming", "software-engineering"],
 *  "coverUrl": "...",
 *  "format": "PAPERBACK"
 * }
 *
 * - authors: 이름 배열 -> Author upsert + BookAuthor 연결
 * - categories: slug 배열 -> Category 찾기(없으면 생성) + BookCategory 연결
 */
export async function createBookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      title,
      price,
      stock,
      isbn13,
      description,
      authors,
      categories,
      coverUrl,
      format,
      language,
      publisher,
      publicationDate,
      currency,
    } = req.body;

    // validation
    if (!title || typeof title !== "string" || title.trim().length < 1) {
      throw new ApiError(400, "VALIDATION_FAILED", "title 은(는) 필수입니다.");
    }
    if (price == null || Number.isNaN(Number(price)) || Number(price) < 0) {
      throw new ApiError(400, "VALIDATION_FAILED", "price 값이 올바르지 않습니다.");
    }
    if (stock == null || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      throw new ApiError(400, "VALIDATION_FAILED", "stock 값이 올바르지 않습니다.");
    }
    if (authors && !Array.isArray(authors)) {
      throw new ApiError(400, "VALIDATION_FAILED", "authors 는 배열이어야 합니다.");
    }
    if (categories && !Array.isArray(categories)) {
      throw new ApiError(400, "VALIDATION_FAILED", "categories 는 배열이어야 합니다.");
    }

    // create base book first
    const created = await prisma.book.create({
      data: {
        title: title.trim(),
        price: Number(price),
        stock: Number(stock),
        isbn13: isbn13 || null,
        description: description || null,
        coverUrl: coverUrl || null,
        format: format || "PAPERBACK",
        language: language || null,
        publisher: publisher || null,
        publicationDate: publicationDate ? new Date(publicationDate) : null,
        currency: currency || "KRW",
      },
    });

    // connect authors (by name)
    if (Array.isArray(authors) && authors.length > 0) {
      for (let i = 0; i < authors.length; i++) {
        const name = String(authors[i]).trim();
        if (!name) continue;

        const author = await prisma.author.upsert({
          where: { id: -1 }, // trick: Prisma requires unique field; we don't have unique(name) in schema
          update: {},
          create: { name },
        }).catch(async () => {
          // If you want true upsert by name, make Author.name unique in schema.
          // For now, create a new author row:
          return prisma.author.create({ data: { name } });
        });

        await prisma.bookAuthor.create({
          data: {
            bookId: created.id,
            authorId: author.id,
            authorOrder: i + 1,
          },
        });
      }
    }

    // connect categories (by slug)
    if (Array.isArray(categories) && categories.length > 0) {
      for (const slugRaw of categories) {
        const slug = String(slugRaw).trim();
        if (!slug) continue;

        // Category.slug is unique in schema (good)
        const category = await prisma.category.upsert({
          where: { slug },
          update: {},
          create: {
            slug,
            name: slug, // 간단히 name=slug; 원하면 별도 name 보내게 바꿔도 됨
          },
        });

        await prisma.bookCategory.create({
          data: { bookId: created.id, categoryId: category.id },
        });
      }
    }

    return res.status(201).json({
      isSuccess: true,
      message: "도서가 등록되었습니다.",
      payload: { bookId: created.id, createdAt: created.createdAt },
    });
  } catch (err: any) {
    // ISBN unique 충돌 등
    if (err?.code === "P2002") {
      return next(
        new ApiError(409, "DUPLICATE_RESOURCE", "중복 데이터가 존재합니다.", {
          target: err?.meta?.target,
        })
      );
    }
    next(err);
  }
}

// -------------------------
// PATCH /books/:id (ADMIN)
// -------------------------
export async function updateBookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseId(req.params.id);

    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    }

    const {
      title,
      price,
      stock,
      isbn13,
      description,
      coverUrl,
      format,
      language,
      publisher,
      publicationDate,
      currency,
      authors,     // optional: replace all
      categories,  // optional: replace all
    } = req.body;

    const dataToUpdate: any = {};

    if (title != null) {
      if (typeof title !== "string" || title.trim().length < 1) {
        throw new ApiError(400, "VALIDATION_FAILED", "title 값이 올바르지 않습니다.");
      }
      dataToUpdate.title = title.trim();
    }
    if (price != null) {
      if (Number.isNaN(Number(price)) || Number(price) < 0) {
        throw new ApiError(400, "VALIDATION_FAILED", "price 값이 올바르지 않습니다.");
      }
      dataToUpdate.price = Number(price);
    }
    if (stock != null) {
      if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
        throw new ApiError(400, "VALIDATION_FAILED", "stock 값이 올바르지 않습니다.");
      }
      dataToUpdate.stock = Number(stock);
    }

    if (isbn13 != null) dataToUpdate.isbn13 = isbn13;
    if (description != null) dataToUpdate.description = description;
    if (coverUrl != null) dataToUpdate.coverUrl = coverUrl;
    if (format != null) dataToUpdate.format = format;
    if (language != null) dataToUpdate.language = language;
    if (publisher != null) dataToUpdate.publisher = publisher;
    if (publicationDate != null)
      dataToUpdate.publicationDate = publicationDate
        ? new Date(publicationDate)
        : null;
    if (currency != null) dataToUpdate.currency = currency;

    const updated = await prisma.book.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, updatedAt: true },
    });

    // Replace authors if provided
    if (authors != null) {
      if (!Array.isArray(authors)) {
        throw new ApiError(400, "VALIDATION_FAILED", "authors 는 배열이어야 합니다.");
      }
      await prisma.bookAuthor.deleteMany({ where: { bookId: id } });

      for (let i = 0; i < authors.length; i++) {
        const name = String(authors[i]).trim();
        if (!name) continue;

        // Better approach: make Author.name unique; for now create if missing
        const author = await prisma.author.create({ data: { name } });

        await prisma.bookAuthor.create({
          data: { bookId: id, authorId: author.id, authorOrder: i + 1 },
        });
      }
    }

    // Replace categories if provided
    if (categories != null) {
      if (!Array.isArray(categories)) {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "categories 는 배열이어야 합니다."
        );
      }
      await prisma.bookCategory.deleteMany({ where: { bookId: id } });

      for (const slugRaw of categories) {
        const slug = String(slugRaw).trim();
        if (!slug) continue;

        const category = await prisma.category.upsert({
          where: { slug },
          update: {},
          create: { slug, name: slug },
        });

        await prisma.bookCategory.create({
          data: { bookId: id, categoryId: category.id },
        });
      }
    }

    return res.status(200).json({
      isSuccess: true,
      message: "도서가 수정되었습니다.",
      payload: { bookId: updated.id, updatedAt: updated.updatedAt },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return next(
        new ApiError(409, "DUPLICATE_RESOURCE", "중복 데이터가 존재합니다.", {
          target: err?.meta?.target,
        })
      );
    }
    next(err);
  }
}

// -------------------------
// DELETE /books/:id (ADMIN) soft delete
// -------------------------
export async function deleteBookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseId(req.params.id);

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "도서를 찾을 수 없습니다.");
    }
    if (book.deletedAt) {
      return res.status(200).json({
        isSuccess: true,
        message: "이미 삭제된 도서입니다.",
        payload: { bookId: id, deletedAt: book.deletedAt },
      });
    }

    const updated = await prisma.book.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    return res.status(200).json({
      isSuccess: true,
      message: "도서가 삭제 처리되었습니다.",
      payload: { bookId: updated.id, deletedAt: updated.deletedAt },
    });
  } catch (err) {
    next(err);
  }
}
