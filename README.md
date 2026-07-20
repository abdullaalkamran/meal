This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Building for production

```bash
npm run build   # runs `next build --webpack` — see DEPLOY.md for why
npm start       # runs the custom server.js on $PORT (default 3000)
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

This app is built to run on **Spaceship Shared Hosting / CloudLinux's Node.js
Selector** via Phusion Passenger, using the custom `server.js` entry point —
not `next start`, and not Docker, a VPS, Vercel, or Railway. See
[DEPLOY.md](./DEPLOY.md) for the full setup guide, including why the build
runs with `--webpack` instead of the default Turbopack.
