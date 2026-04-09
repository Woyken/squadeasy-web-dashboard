import { Avatars } from "./Avatars";

export function UsersAvatarsPreview(props: { userIds: string[] }) {
    return <Avatars userIds={props.userIds} />;
}
