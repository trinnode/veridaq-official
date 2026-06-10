---
mode: agent
description: Add a new Fastify API route with proper validation, auth, and error handling
---

I need to add a new API route to the VERIDAQ backend.

Route details:

- HTTP method: ${method}
- Path: ${path}
- Auth required: ${requiresAuth}
- Role: ${role}
- Request body schema (describe it): ${bodyDescription}
- What it should do: ${description}

Please generate:

1. A Zod schema for the request body (in the route file).
2. The Fastify route handler with proper auth middleware preHandler.
3. A corresponding service function in the appropriate service file.
4. A Prisma query inside the service.
5. Proper error handling using Fastify's error reply system.
6. Follow the coding conventions in .github/copilot-instructions.md exactly.

Do not use any, do not skip validation, do not skip auth where required.
