import { Accessor, JSX, createMemo } from "solid-js";
import { useMyUserQuery } from "~/api/client";

export function UserLoader(props: {
    userId: string;
    children: (
        query: ReturnType<typeof useMyUserQuery>,
        displayName: Accessor<string | undefined>
    ) => JSX.Element;
}) {
    const query = useMyUserQuery(() => props.userId);
    const displayName = createMemo(() => {
        if (query.isLoading) return;
        if (query.isError) return "Error!";
        if (query.data?.firstName || query.data?.lastName)
            return [query.data.firstName, query.data.lastName]
                .filter((x) => !!x)
                .join(" ");
        if (query.data?.email) return query.data?.email;
    });
    return <>{props.children(query, displayName)}</>;
}
