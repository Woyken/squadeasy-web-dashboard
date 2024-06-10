import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { useAutoBoosterSetting } from "~/components/AutoBooster";
import { Toggle } from "~/components/Toggle";

export default function Home() {
    const [params] = useSearchParams();
    const boost = useAutoBoosterSetting(() => params.id!);
    return (
        <main class="flex items-center overflow-y-auto bg-base-200 px-6 pt-4 md:pt-4">
            <Title>User settings</Title>
            <div class="card mx-auto mt-2 w-72 max-w-5xl bg-base-100 p-6 shadow-xl">
                <div class="text-xl font-semibold">Settings</div>
                <div class="divider mt-2" />
                <Toggle
                    checked={boost.autoBoost()}
                    onChecked={(checked) => {
                        boost.setAutoBoost(checked);
                    }}
                    label="Auto boost"
                />
            </div>
        </main>
    );
}
