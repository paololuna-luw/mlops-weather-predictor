"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative z-10 mx-auto max-w-xl px-4 py-16">
      <p className="kicker">Something interrupted this view</p>
      <h1 className="mt-3 text-3xl leading-tight">The page hit a display error</h1>
      <p className="mt-4 leading-7 text-ink/75">
        A translator extension can rewrite the page and trip the next update. The forecast itself is unchanged.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-full bg-lake px-5 py-2.5 text-sm font-semibold text-white"
      >
        Show the forecast again
      </button>
    </main>
  );
}
