import { Show, createMemo } from "solid-js";
import { useUserByIdQuery } from "~/api/client";

export function Avatar(props: { userId: string; size?: number }) {
  const query = useUserByIdQuery(() => props.userId);
  const sz = () => props.size ?? 32;
  const initials = createMemo(() => {
    const data = query.data;
    if (!data?.firstName) return "?";
    return (
      (data.firstName[0] ?? "") + (data.lastName?.[0] ?? "")
    ).toUpperCase();
  });
  const imageUrl = createMemo(() => query.data?.imageUrl ?? undefined);

  return (
    <div
      class="brut-avatar shrink-0"
      style={{ width: `${sz()}px`, height: `${sz()}px`, "font-size": `${sz() * 0.36}px` }}
    >
      <Show
        when={imageUrl()}
        fallback={
          <span class="inline-grid h-full w-full place-items-center bg-black text-white">
            {initials()}
          </span>
        }
      >
        <img
          src={imageUrl()}
          alt={initials()}
          class="h-full w-full object-cover"
          loading="lazy"
        />
      </Show>
    </div>
  );
}
