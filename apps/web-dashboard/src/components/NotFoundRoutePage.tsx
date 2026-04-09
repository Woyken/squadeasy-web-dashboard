import { Link } from "@tanstack/solid-router";

export function NotFound() {
  return (
    <div class="grid min-h-[calc(100vh-48px)] place-items-center bg-white font-mono">
      <div class="border-[3px] border-black p-8 text-center">
        <div class="mb-4 text-5xl font-bold">404</div>
        <div class="mb-2 bg-black px-3 py-1.5 text-[11px] tracking-widest text-[var(--color-brut-red)]">
          STATUS: NOT_FOUND
        </div>
        <p class="mb-6 text-xs text-[var(--color-brut-gray)]">
          REQUESTED ROUTE DOES NOT EXIST
        </p>
        <Link to="/" class="brut-btn-primary inline-block no-underline">
          [GO_HOME]
        </Link>
      </div>
    </div>
  );
}
