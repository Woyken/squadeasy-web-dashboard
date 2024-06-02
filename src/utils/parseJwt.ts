export function parseJwt(token: string) {
    var base64Url = token.split(".")[1];
    var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    var jsonPayload = decodeURIComponent(
        window
            .atob(base64)
            .split("")
            .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
    );

    const json = JSON.parse(jsonPayload);
    if (
        json &&
        typeof json === "object" &&
        "exp" in json &&
        typeof json.exp === "number" &&
        "id" in json &&
        typeof json.id === "string"
    )
        return json;
    throw new Error(`Unable to parse token ${jsonPayload}`);
}
