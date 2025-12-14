import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Online Bookstore API",
      version: "1.0.0",
      description:
        "Bookstore backend API (Auth, Users, Books, Reviews, Comments, Wishlist, Cart, Orders)",
    },
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local",
      },
      // 배포 서버는 README에 실제 JCloud URL:PORT로 적기
    ],
    tags: [
      { name: "Auth", description: "Authentication" },
      { name: "Users", description: "User profile & admin" },
      { name: "Books", description: "Book management" },
      { name: "Reviews", description: "Reviews & likes" },
      { name: "Comments", description: "Comments & likes" },
      { name: "Wishlist", description: "Wishlist" },
      { name: "Cart", description: "Cart" },
      { name: "Orders", description: "Orders" },
      { name: "Health", description: "Healthcheck" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ✅ 공통 성공/에러 포맷
        SuccessResponse: {
          type: "object",
          properties: {
            isSuccess: { type: "boolean", example: true },
            message: { type: "string", example: "성공" },
            payload: { type: "object", nullable: true },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            timestamp: { type: "string", example: "2025-03-05T12:34:56Z" },
            path: { type: "string", example: "/orders" },
            status: { type: "number", example: 401 },
            code: { type: "string", example: "UNAUTHORIZED" },
            message: { type: "string", example: "인증 토큰 없음 또는 잘못된 토큰" },
            details: { type: "object", nullable: true, example: { reason: "token expired" } },
          },
        },

        // ✅ 자주 쓰는 DTO 스키마 예시 (필요한 것 계속 추가)
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", example: "user1@example.com" },
            password: { type: "string", example: "P@ssw0rd!" },
          },
        },
        LoginResponsePayload: {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOi..." },
            refreshToken: { type: "string", example: "eyJhbGciOi..." },
          },
        },
      },
    },

    // ✅ (선택) 전역 security를 걸면 “public endpoint”에서도 자물쇠가 생길 수 있음
    // security: [{ bearerAuth: [] }],
  },

  // 여기에 swagger 주석이 들어있는 파일 경로를 넣기
  apis: ["src/**/*.routes.ts", "src/**/*.controller.ts"],
});
