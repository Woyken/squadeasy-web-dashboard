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
        <main class="flex flex-1 items-start justify-center bg-base-200 bg-grid px-4 py-8 sm:px-6">
            <div class="bg-glow absolute inset-0" />
            <Title>User Settings — SquadEasy</Title>
            <div class="relative z-10 w-full max-w-md animate-fade-in-up">
                <div class="gradient-card p-6 sm:p-8">
                    <h2 class="section-header mb-6">Settings</h2>
                    <div class="flex flex-col gap-4">
                        <Toggle
                            checked={mainUser.mainUserId() === userId()}
                            onChecked={(checked) =>
                                checked
                                    ? mainUser.setMainUserId(userId())
                                    : mainUser.setMainUserId(undefined)
                            }
                            label="Main user"
                            description="Used for common queries"
                        />
                        <Toggle
                            checked={boost.autoBoost()}
                            onChecked={(checked) => {
                                boost.setAutoBoost(checked);
                            }}
                            label="Auto boost"
                            description="Automatically boost highest-scoring teammate"
                        />
                        <Toggle
                            checked={autoLikeTeamPosts.autoLikeTeamPosts(
                                userId(),
                            )}
                            onChecked={(checked) => {
                                autoLikeTeamPosts.setAutoLikeTeamPosts(
                                    userId(),
                                    checked,
                                );
                            }}
                            label="Auto like posts"
                            description="Automatically like team member posts"
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
