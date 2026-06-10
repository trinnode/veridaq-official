---
mode: agent
description: Add a new page to the VERIDAQ frontend portal
---

I need to add a new page to the ${portal} portal (institution / employer / admin).

Page details:

- Route: ${route}
- What it shows: ${description}
- Data it needs from the API: ${apiEndpoints}
- Is it a server component or client component: ${componentType}

Please generate:

1. The Next.js App Router page file at the correct path.
2. Any necessary loading.tsx and error.tsx files.
3. The data fetching logic (server component: fetch with cookie forwarding;
   client component: use @tanstack/react-query).
4. The full UI using Tailwind classes matching the dark theme (void background,
   surface cards, accent green for actions).
5. Responsive layout with mobile consideration.
6. Follow the coding conventions in .github/copilot-instructions.md exactly.
