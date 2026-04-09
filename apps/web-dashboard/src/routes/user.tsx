import { Title } from "@solidjs/meta";
import { createFileRoute } from "@tanstack/solid-router";
import { useAutoBoosterSetting } from "~/components/AutoBooster";
import { useAutoLikeTeamPosts } from "~/components/AutoLikeTeamPosts";
import { useMainUser } from "~/components/MainUserProvider";
import { Toggle } from "~/components/Toggle";
import * as v from "valibot";

export const Route = createFileRoute("/user")({
    component: RouteComponent,
    validateSearch: v.object({
        id: v.string(),
    }),
});

function RouteComponent() {
    const userId = Route.useSearch({ select: (s) => s.id });
    const boost = useAutoBoosterSetting(userId);
    const autoLikeTeamPosts = useAutoLikeTeamPosts();
    const mainUser = useMainUser();
    return (
        <main class="flex items-center overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>User settings</Title>
            <div class="card mx-auto mt-2 w-72 max-w-5xl bg-base-100 p-6 shadow-xl">
                <div class="text-xl font-semibold">Settings</div>
                <div class="divider mt-2" />
                <Toggle
                    checked={mainUser.mainUserId() === userId()}
                    onChecked={(checked) =>
                        checked
                            ? mainUser.setMainUserId(userId())
                            : mainUser.setMainUserId(undefined)
                    }
                    label="Set as main user (will be used for common queries)"
                />
                <Toggle
                    checked={boost.autoBoost()}
                    onChecked={(checked) => {
                        boost.setAutoBoost(checked);
                    }}
                    label="Auto boost"
                />
                <Toggle
                    checked={autoLikeTeamPosts.autoLikeTeamPosts(userId())}
                    onChecked={(checked) => {
                        autoLikeTeamPosts.setAutoLikeTeamPosts(
                            userId(),
                            checked,
                        );
                    }}
                    label="Auto like team posts"
                />
            </div>
        </main>
    );
}
