export function getUserDisplayName(
    userData:
        | { firstName?: string; lastName?: string; email: string }
        | undefined
) {
    if (userData?.firstName || userData?.lastName)
        return [userData.firstName, userData.lastName]
            .filter((x) => !!x)
            .join(" ");
    if (userData?.email) return userData?.email;
}

export function getUserInitials(
    userData:
        | { firstName?: string; lastName?: string; email: string }
        | undefined
) {
    if (!userData) return;
    if (userData.firstName && userData.lastName)
        return (
            userData.firstName.slice(0, 1) + userData.lastName.slice(0, 1)
        ).toUpperCase();

    return (userData.firstName ?? userData.lastName ?? userData.email)
        .slice(0, 2)
        .toUpperCase();
}
