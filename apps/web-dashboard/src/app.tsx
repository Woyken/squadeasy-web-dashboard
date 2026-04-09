import { RouterProvider, createRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";
import "./app.css";

const router = createRouter({
    routeTree,
    basepath: import.meta.env.BASE_URL,
});

declare module "@tanstack/solid-router" {
    interface Register {
        router: typeof router;
    }
}

export default function App() {
    return <RouterProvider router={router} />;
}
