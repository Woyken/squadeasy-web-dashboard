import { Accessor, JSX, createMemo } from "solid-js";
import { useMyUserQuery } from "~/api/client";
import { getUserDisplayName } from "~/getUserDisplayName";

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
        return getUserDisplayName(query.data);
    });
    return <>{props.children(query, displayName)}</>;
}
