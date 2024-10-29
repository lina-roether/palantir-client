function hostPermissionPattern(serverUrl: URL) {
	return `*://${serverUrl.hostname}/*`;
}

export async function hasHostPermissions(serverUrl: URL) {
	const pattern = hostPermissionPattern(serverUrl);
	 const permissions = await browser.permissions.getAll();

	 if (!permissions.origins) return false;

	 return permissions.origins.includes(pattern);
}

export async function requestHostPermissions(serverUrl: URL): Promise<boolean> {
	const pattern = hostPermissionPattern(serverUrl);
	// This has to be this way, because we can only request permissions directly inside a user action
	// handler, and awaiting a promise loses that status
	const received = await browser.permissions.request({
		origins: [pattern]
	});
	if (!received) return false;

	const permissions = await browser.permissions.getAll();
	const oldPatterns = (permissions.origins ?? []).filter((p) => p != pattern);
	if (oldPatterns.length != 0) {
		await browser.permissions.remove({
			origins: oldPatterns
		});
	}
	return true;
}
