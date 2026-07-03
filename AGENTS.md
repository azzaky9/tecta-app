<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Development Workflow
- Do NOT run `next build` or `npm run build` after completing changes. The user runs a local dev server (`npm run dev`) that provides live feedback. Only build if the user explicitly asks for it.

## Package Manager & Runtime
- ALWAYS use `bun` instead of `npm`, `npx`, `yarn`, or `pnpm`.
- Use `bun run dev` instead of `npm run dev`.
- Use `bun install` or `bun add` instead of `npm install`.
- Use `bunx` instead of `npx`.
