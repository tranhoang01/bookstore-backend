# Online Bookstore API Server

## 1. Project Overview
This project is a backend API server for an **Online Bookstore**.
It is implemented based on the **database schema and API design** from Assignment 1 and deployed on **JCloud**.

The server provides:
- JWT-based authentication & authorization (USER / ADMIN)
- Book, Review, Comment management
- Wishlist, Cart, Order system
- Admin statistics APIs
- Swagger (OpenAPI) documentation
- Postman collection for API testing

---

## 2. Tech Stack

| Category | Technology |
|--------|------------|
| Language | TypeScript |
| Runtime | Node.js (v20) |
| Framework | Express.js |
| ORM | Prisma |
| Database | MySQL |
| Authentication | JWT (Access / Refresh Token) |
| Password Hashing | bcrypt |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) |
| Process Manager | PM2 |
| Deployment | JCloud (Ubuntu 24.04) |

---

## 3. Project Structure

repo-root
├─ src/
│ ├─ modules/
│ │ ├─ auth/
│ │ ├─ users/
│ │ ├─ books/
│ │ ├─ reviews/
│ │ ├─ comments/
│ │ ├─ wishlist/
│ │ ├─ cart/
│ │ ├─ orders/
│ │ └─ stats/
│ ├─ middlewares/
│ ├─ docs/ # swagger configuration
│ └─ server.ts
├─ prisma/
│ ├─ schema.prisma
│ └─ seed.ts
├─ postman/
│ └─ bookstore.postman_collection.json
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md


---

## 4. Environment Variables

All sensitive values are managed via `.env` file.  
⚠️ **`.env` is NOT included in this public repository.**

### `.env.example`

```env
PORT=10156
NODE_ENV=production
BUILD_TIME=2025-12-14

DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/bookstore"

JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=*

5. How to Run Locally
# install dependencies
npm install

# prisma generate
npx prisma generate

# migrate database
npx prisma migrate dev

# seed data (200+ records)
npx prisma db seed

# run development server
npm run dev

6. Deployment (JCloud)

Base URL
http://113.198.66.68:10156

Swagger UI
http://113.198.66.68:10156/docs

Health Check
http://113.198.66.68:10156/health

Process Manager
PM2 is used to keep the server running after reboot.

7. API Documentation (Swagger)

Swagger UI provides:

Request / Response schemas

Example payloads

Error responses (400, 401, 403, 404, 422, 500)

Access URL:

GET /docs

8. Authentication & Authorization
Authentication

JWT-based authentication

Access Token + Refresh Token

Token refresh supported

Roles
Role	Description
USER	Normal user
ADMIN	Administrator
Admin-only APIs

User list

User deactivation

Statistics APIs

9. Example Test Accounts
Role	Email	Password
USER	user1@example.com
	P@ssw0rd!
ADMIN	admin@example.com
	P@ssw0rd!
10. Major API Endpoints Summary
Auth

POST /auth/signup

POST /auth/login

POST /auth/refresh

POST /auth/logout

Users

GET /users/me

PATCH /users/me

DELETE /users/me

GET /users (ADMIN)

PATCH /users/{id}/deactivate (ADMIN)

Books

GET /books

GET /books/{id}

POST /books (ADMIN)

PATCH /books/{id} (ADMIN)

DELETE /books/{id} (ADMIN)

Reviews & Comments

POST /reviews/books/{bookId}

GET /reviews/books/{bookId}

POST /reviews/{id}/like

POST /comments/reviews/{reviewId}

POST /comments/{id}/like

Wishlist

GET /wishlist

POST /wishlist/{bookId}

DELETE /wishlist/{bookId}

Cart & Orders

GET /cart

POST /cart/items

PATCH /cart/items/{bookId}

DELETE /cart/items/{bookId}

POST /orders

GET /orders

GET /orders/{id}

Stats (ADMIN)

GET /stats/top-books

GET /stats/daily

11. Postman Collection

Postman collection JSON is provided in:

/postman/bookstore.postman_collection.json


Features:

Environment variables

Auto token save (login)

Authorization header injection

Error case testing

Collection Runner supported

12. Error Handling

All API errors follow a unified format:

{
  "timestamp": "2025-03-05T12:34:56Z",
  "path": "/api/books/1",
  "status": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "Book not found",
  "details": null
}

13. Health Check
GET /health


Response:

{
  "isSuccess": true,
  "message": "OK",
  "payload": {
    "version": "1.0.0",
    "buildTime": "2025-12-14"
  }
}

14. Security Considerations

Password hashing using bcrypt

JWT secrets stored in environment variables

.env and key files are excluded from GitHub

CORS configured explicitly

Soft delete applied to critical resources

15. Limitations & Future Improvements

Payment gateway integration

Redis caching for Top-N APIs

CI/CD automation

Docker-based deployment