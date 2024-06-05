export function Toggle(props: {
    label: string;
    checked: boolean;
    onChecked: (state: boolean) => void;
}) {
    return (
        <div class="form-control">
            <label class="label cursor-pointer">
                <span class="label-text">{props.label}</span>
                <input
                    type="checkbox"
                    class="toggle"
                    checked={props.checked}
                    onchange={(e) => props.onChecked(e.currentTarget.checked)}
                />
            </label>
        </div>
    );
}
