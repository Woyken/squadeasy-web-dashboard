import { Title } from "@solidjs/meta";

export function NotFound() {
    return (
        <main class="flex flex-1 flex-col items-center justify-center bg-base-200 bg-grid">
            <div class="bg-glow absolute inset-0" />
            <Title>Not Found — SquadEasy</Title>
            <div class="relative z-10 animate-fade-in text-center">
                <div class="mb-4 text-6xl">🔍</div>
                <h1 class="mb-2 text-4xl font-extrabold text-gradient">404</h1>
                <p class="text-base-content/50">Page not found</p>
                <a
                    href="/"
                    class="mt-6 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-content transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
                >
                    Go home
                </a>
            </div>
        </main>
    );
}
