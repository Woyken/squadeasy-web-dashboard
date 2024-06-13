import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { useAutoBoosterSetting } from "~/components/AutoBooster";
import { useAutoLikeTeamPosts } from "~/components/AutoLikeTeamPosts";
import { useMainUser } from "~/components/MainUserProvider";
import { Toggle } from "~/components/Toggle";

export default function Home() {
    const [params] = useSearchParams();
    const boost = useAutoBoosterSetting(() => params.id!);
    const autoLikeTeamPosts = useAutoLikeTeamPosts();
    const mainUser = useMainUser();
    return (
        <main class="flex items-center overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>User settings</Title>
            <div class="card mx-auto mt-2 w-72 max-w-5xl bg-base-100 p-6 shadow-xl">
                <div class="text-xl font-semibold">Settings</div>
                <div class="divider mt-2" />
                <Toggle
                    checked={mainUser.mainUserId() === params.id}
                    onChecked={(checked) =>
                        checked
                            ? mainUser.setMainUserId(params.id)
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
                    checked={autoLikeTeamPosts.autoLikeTeamPosts(params.id!)}
                    onChecked={(checked) => {
                        autoLikeTeamPosts.setAutoLikeTeamPosts(
                            params.id!,
                            checked,
                        );
                    }}
                    label="Auto like team posts"
                />
            </div>
        </main>
    );
}
