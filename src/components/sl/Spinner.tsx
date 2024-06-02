import { clientOnly } from "@solidjs/start";
const Spinner = clientOnly(() => import("./ClientSpinner"));
export default Spinner;
