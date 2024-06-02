import { clientOnly } from "@solidjs/start";
const Button = clientOnly(() => import("./ClientButton"));
export default Button;
