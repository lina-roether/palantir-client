const NAME_MAP = {
	"prod": "Palantir",
	"debug": "Palantir (DEBUG)"
}

const CONTENT_SECURITY_POLICY_MAP = {
	"prod": "default-src 'self'; upgrade-insecure-requests;",
	"debug": "default-src 'self';"
}


export default (context) => ({
	manifest_version: 3,
	name: NAME_MAP[context.environment],
	version: context.version,
	description: "A browser extension to watch videos together remotely on any website",
	permissions: ["tabs", "storage"],
	content_security_policy: {
		extension_pages: CONTENT_SECURITY_POLICY_MAP[context.environment]
	},
	options_page: context.include("+options.pug")
})
