import { createMemo, type JSX } from "solid-js";
import {
  getMyUserQueryOptions,
  useGetUserToken,
} from "~/api/client";
import { useQuery } from "@tanstack/solid-query";

export function UserLoader(props: {
  userId: string;
  children: (query: { isLoading: boolean }, displayName: () => string) => JSX.Element;
}) {
  const getUserToken = useGetUserToken(() => props.userId);
  const query = useQuery(() =>
    getMyUserQueryOptions(() => props.userId, getUserToken),
  );
  const displayName = createMemo(() => {
    const data = query.data;
    if (!data) return props.userId.slice(0, 8);
    return data.firstName
      ? `${data.firstName} ${data.lastName ?? ""}`.trim()
      : props.userId.slice(0, 8);
  });

  return <>{props.children({ isLoading: query.isLoading }, displayName)}</>;
}
