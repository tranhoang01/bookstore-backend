import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { errorHandler } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/auth.routes"; // THÊM DÒNG NÀY (sau khi tạo file routes)
import { userRouter } from "./modules/users/user.routes";
import { statsRouter } from "./modules/stats/stats.routes";
import { bookRouter } from "./modules/books/book.routes";
import { reviewRouter } from "./modules/reviews/review.routes";
import { commentRouter } from "./modules/comments/comment.routes";
import { wishlistRouter } from "./modules/wishlist/wishlist.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { orderRouter } from "./modules/orders/order.routes";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";






const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Health check
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: 인증 없이 서버 상태 확인 (버전/빌드 정보 포함)
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             example:
 *               isSuccess: true
 *               message: "OK"
 *               payload:
 *                 version: "1.0.0"
 *                 buildTime: "2025-12-13T00:00:00Z"
 */   
app.get("/health", (req, res) => {
  res.json({
    isSuccess: true,
    message: "OK",
    payload: {
      version: "1.0.0",
      buildTime: process.env.BUILD_TIME ?? null,
    },
  });
});


// Routers
app.use("/auth", authRouter);
app.use("/users", userRouter);

// ...
app.use("/stats", statsRouter);

// ...
app.use("/books", bookRouter);


// ...
app.use("/reviews", reviewRouter);

// ...
app.use("/comments", commentRouter);

// ...
app.use("/wishlist", wishlistRouter);

// ...
app.use("/cart", cartRouter);

// ...
app.use("/orders", orderRouter);

// ...app 생성 후
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

// Error handler MUST be last
app.use(errorHandler);

export default app;
