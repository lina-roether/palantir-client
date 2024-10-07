const DESCRIPTION_MAP = {
	"prod": "A browser extension to watch videos together remotely on any website",
	"debug": "(DEBUG VERSION) A browser extension to watch videos together remotely on any website"
}

const CONTENT_SECURITY_POLICY_MAP = {
	"prod": "default-src 'self'; upgrade-insecure-requests;",
	"debug": "default-src 'self';"
}


export default (context) => ({
	manifest_version: 3,
	name: "Palantir",
	version: context.version,
	description: DESCRIPTION_MAP[context.environment],
	permissions: ["tabs", "storage"],
	content_security_policy: {
		extension_pages: CONTENT_SECURITY_POLICY_MAP[context.environment]
	}
})
