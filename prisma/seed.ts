// prisma/seed.ts
import {
  PrismaClient,
  Prisma,
  UserRole,
  BookFormat,
  CartStatus,
  OrderStatus,
  PaymentStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

function must<T>(value: T | null | undefined, msg: string): T {
  if (value === null || value === undefined) throw new Error(msg);
  return value;
}

/**
 * EXACTLY 200 records total across all tables.
 *
 * Counts:
 * - User: 12
 * - RefreshToken: 10
 * - Author: 8
 * - Category: 6
 * - Book: 30
 * - BookAuthor: 30
 * - BookCategory: 30
 * - Review: 30
 * - ReviewLike: 18
 * - Comment: 10
 * - CommentLike: 6
 * - WishlistItem: 3
 * - LibraryItem: 1
 * - Cart: 2
 * - CartItem: 2
 * - Order: 1
 * - OrderItem: 1
 * TOTAL = 200
 */

async function main() {
  // Clean for repeatable seed
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.libraryItem.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.commentLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.reviewLike.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bookCategory.deleteMany();
  await prisma.bookAuthor.deleteMany();
  await prisma.book.deleteMany();
  await prisma.category.deleteMany();
  await prisma.author.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // 1) Users (12)
  const passwordHash = await bcrypt.hash("P@ssw0rd!", 10);

  await prisma.user.createMany({
    data: [
      {
        email: "admin@example.com",
        passwordHash,
        name: "Admin",
        phone: "010-0000-0000",
        role: UserRole.ADMIN,
      },
      ...Array.from({ length: 11 }).map((_, i) => ({
        email: `user${i + 1}@example.com`,
        passwordHash,
        name: `User ${i + 1}`,
        phone: `010-1000-${String(1000 + i).slice(-4)}`,
        role: UserRole.CUSTOMER,
      })),
    ],
  });

  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: { id: true, role: true, email: true },
  });
  if (users.length !== 12) throw new Error("Seed invariant failed: users != 12");

  const admin = users[0];
  const customers = users.slice(1);
  if (customers.length !== 11) throw new Error("Seed invariant failed: customers != 11");

  // 2) RefreshToken (10)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.createMany({
    data: Array.from({ length: 10 }).map((_, i) => ({
      userId: must(users[i], `users[${i}] missing`).id,
      tokenHash: `seed_token_hash_${i + 1}`,
      userAgent: "seed-agent",
      ipAddress: "127.0.0.1",
      revoked: false,
      expiresAt,
    })),
  });

  // 3) Authors (8)
  await prisma.author.createMany({
    data: Array.from({ length: 8 }).map((_, i) => ({
      name: `Author ${i + 1}`,
      bio: `Bio for author ${i + 1}`,
    })),
  });

  const authors = await prisma.author.findMany({ orderBy: { id: "asc" }, select: { id: true } });
  if (authors.length !== 8) throw new Error("Seed invariant failed: authors != 8");

  // 4) Categories (6)
  await prisma.category.createMany({
    data: [
      { name: "Programming", slug: "programming" },
      { name: "Database", slug: "database" },
      { name: "AI", slug: "ai" },
      { name: "Web", slug: "web" },
      { name: "Cloud", slug: "cloud" },
      { name: "Network", slug: "network" },
    ],
  });

  const categories = await prisma.category.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (categories.length !== 6) throw new Error("Seed invariant failed: categories != 6");

  // 5) Books (30)
  const basePrice = 12000;

  await prisma.book.createMany({
    data: Array.from({ length: 30 }).map((_, i) => ({
      title: `Sample Book ${i + 1}`,
      isbn13: `97800000000${String(i + 1).padStart(2, "0")}`,
      description: `This is a seeded book ${i + 1}.`,
      price: new Prisma.Decimal(basePrice + (i % 10) * 1000),
      currency: "KRW",
      stock: 50 + (i % 5) * 10,
      publicationDate: new Date(2020, i % 12, 1),
      coverUrl: `https://example.com/covers/${i + 1}.jpg`,
      format: i % 2 === 0 ? BookFormat.PAPERBACK : BookFormat.HARDCOVER,
      language: "ko",
      publisher: "Seed Publisher",
      avgRating: new Prisma.Decimal(0),
      reviewCount: 0,
    })),
  });

  const books = await prisma.book.findMany({
    orderBy: { id: "asc" },
    select: { id: true, title: true, price: true },
  });
  if (books.length !== 30) throw new Error("Seed invariant failed: books != 30");

  // 6) BookAuthor (30)
  await prisma.bookAuthor.createMany({
    data: books.map((b, idx) => ({
      bookId: b.id,
      authorId: must(authors[idx % authors.length], "author missing").id,
      authorOrder: 1,
    })),
  });

  // 7) BookCategory (30)
  await prisma.bookCategory.createMany({
    data: books.map((b, idx) => ({
      bookId: b.id,
      categoryId: must(categories[idx % categories.length], "category missing").id,
    })),
  });

  // 8) Reviews (30) unique (userId, bookId)
  await prisma.review.createMany({
    data: books.map((b, idx) => ({
      userId: must(customers[idx % customers.length], "customer missing").id,
      bookId: b.id,
      title: `Review title ${idx + 1}`,
      content: `This is a seeded review for book ${b.id}.`,
      rating: (idx % 5) + 1,
      likeCount: 0,
      commentCount: 0,
    })),
  });

  const reviews = await prisma.review.findMany({
    orderBy: { id: "asc" },
    select: { id: true, userId: true },
  });
  if (reviews.length !== 30) throw new Error("Seed invariant failed: reviews != 30");

  // 9) ReviewLike (18)
  const reviewLikesData: { userId: number; reviewId: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const rv = must(reviews[i], `reviews[${i}] missing`);
    const liker = must(customers[(i + 1) % customers.length], "liker missing");
    if (liker.id === rv.userId) {
      const alt = must(customers[(i + 2) % customers.length], "alt liker missing");
      reviewLikesData.push({ userId: alt.id, reviewId: rv.id });
    } else {
      reviewLikesData.push({ userId: liker.id, reviewId: rv.id });
    }
  }
  await prisma.reviewLike.createMany({ data: reviewLikesData });

  // 10) Comments (10)
  const commentsCreate = Array.from({ length: 10 }).map((_, i) => ({
    reviewId: must(reviews[i], `reviews[${i}] missing`).id,
    userId: must(customers[(i + 3) % customers.length], "customer missing").id,
    parentId: null as any,
    content: `Seeded comment ${i + 1}`,
    likeCount: 0,
  }));
  await prisma.comment.createMany({ data: commentsCreate });

  const comments = await prisma.comment.findMany({
    orderBy: { id: "asc" },
    select: { id: true, userId: true },
  });
  if (comments.length !== 10) throw new Error("Seed invariant failed: comments != 10");

  // 11) CommentLike (6)
  const commentLikesData: { userId: number; commentId: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const c = must(comments[i], `comments[${i}] missing`);
    const liker = must(customers[(i + 4) % customers.length], "liker missing");
    if (liker.id === c.userId) {
      const alt = must(customers[(i + 5) % customers.length], "alt liker missing");
      commentLikesData.push({ userId: alt.id, commentId: c.id });
    } else {
      commentLikesData.push({ userId: liker.id, commentId: c.id });
    }
  }
  await prisma.commentLike.createMany({ data: commentLikesData });

  // 12) WishlistItem (3)
  const c0 = must(customers[0], "customers[0] missing");
  const c1 = must(customers[1], "customers[1] missing");
  const c2 = must(customers[2], "customers[2] missing");

  const b0 = must(books[0], "books[0] missing");
  const b1 = must(books[1], "books[1] missing");
  const b2 = must(books[2], "books[2] missing");

  await prisma.wishlistItem.createMany({
    data: [
      { userId: c0.id, bookId: b0.id },
      { userId: c1.id, bookId: b1.id },
      { userId: c2.id, bookId: b2.id },
    ],
  });

  // 13) LibraryItem (1)
  const c3 = must(customers[3], "customers[3] missing");
  const b3 = must(books[3], "books[3] missing");

  await prisma.libraryItem.create({
    data: {
      userId: c3.id,
      bookId: b3.id,
      acquiredAt: new Date(),
    },
  });

  // 14) Cart (2)
  const activeCart = await prisma.cart.create({
    data: { userId: c0.id, status: CartStatus.ACTIVE },
    select: { id: true, userId: true },
  });

  const checkedOutCart = await prisma.cart.create({
    data: { userId: c1.id, status: CartStatus.CHECKED_OUT },
    select: { id: true, userId: true },
  });

  // 15) CartItem (2)
  await prisma.cartItem.createMany({
    data: [
      { cartId: activeCart.id, bookId: b0.id, quantity: 2, unitPrice: b0.price },
      { cartId: checkedOutCart.id, bookId: b1.id, quantity: 1, unitPrice: b1.price },
    ],
  });

  // 16) Order (1) + OrderItem (1)
  const totalAmount = new Prisma.Decimal(Number(b1.price) * 1);

  const order = await prisma.order.create({
    data: {
      userId: checkedOutCart.userId,
      cartId: checkedOutCart.id,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount,
      placedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      bookId: b1.id,
      quantity: 1,
      unitPrice: b1.price,
      bookTitleSnapshot: b1.title,
    },
  });

  // Optional logs
  console.log("✅ Seed created (admin exists).");

}

main()
  .then(() => console.log("✅ Seed completed (exactly 200 records)."))
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
