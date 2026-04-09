import { createMemo, type JSX } from "solid-js";
import { useMyUserQuery } from "~/api/client";

export function UserLoader(props: {
  userId: string;
  children: (query: { isLoading: boolean }, displayName: () => string) => JSX.Element;
}) {
  const query = useMyUserQuery(() => props.userId);
  const displayName = createMemo(() => {
    const data = query.data;
    if (!data) return props.userId.slice(0, 8);
    return data.firstName
      ? `${data.firstName} ${data.lastName ?? ""}`.trim()
      : props.userId.slice(0, 8);
  });

  return <>{props.children({ isLoading: query.isLoading }, displayName)}</>;
}
