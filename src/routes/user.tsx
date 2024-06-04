import { Title } from "@solidjs/meta";
import { useParams } from "@solidjs/router";
import { useAutoBoosterSetting } from "~/components/AutoBooster";
import Switch from "~/components/sl/Switch";

export default function Home() {
    const params = useParams();
    const boost = useAutoBoosterSetting(() => params.id);
    return (
        <main>
            <Title>User settings</Title>
            <Switch
                prop:checked={boost.autoBoost()}
                onsl-change={(e: any) => {
                    boost.setAutoBoost(e.currentTarget.checked);
                }}
            >
                Auto boost
            </Switch>
        </main>
    );
}
