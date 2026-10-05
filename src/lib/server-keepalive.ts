import { after } from 'next/server'

/**
 * Register an in-flight promise with Next.js after() so the serverless
 * function (Vercel) stays alive until it settles.
 *
 * WHY: fire-and-forget calls like `sendEmail(...).catch(...)` without `await`
 * get FROZEN mid-flight the moment the route returns its response — on Vercel
 * the pending SMTP/API request never completes. Symptom: "first OTP never
 * arrives, clicking resend delivers the old one together with the new one"
 * (the next warm invocation unfreezes the earlier promise).
 *
 * after() is the platform-sanctioned fix: response is sent immediately, but
 * the runtime is kept alive until the tracked promise resolves.
 *
 * Outside a request scope (scripts, cron-less contexts) after() throws —
 * we swallow that and behave like a plain fire-and-forget.
 */
export function keepAlive<T>(p: Promise<T>): void {
  try {
    // thunk returning a never-rejecting derivative so after() never
    // surfaces an unhandled rejection; the caller's own .catch still fires
    after(() => p.catch(() => {}))
  } catch {
    /* not in request scope — nothing to keep alive */
  }
}
