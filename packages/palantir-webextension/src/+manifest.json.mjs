const EXTENSION_ID = "{cbaa7c2d-7a63-4d10-bcca-1de052432aa0}";

const NAME_MAP = {
	"prod": "Palantir",
	"debug": "Palantir (DEBUG)"
}

const CONTENT_SECURITY_POLICY_MAP = {
	"prod": "default-src 'self'; upgrade-insecure-requests;",
	"debug": "default-src 'self';"
}

const BROWSER_SPECIFIC_SETTINGS_MAP = {
	"firefox": {
		gecko: {
			id: EXTENSION_ID
		}
	},
	"chromium": undefined
}

export default (context) => ({
	manifest_version: 3,
	name: NAME_MAP[context.environment],
	version: context.version,
	description: "A browser extension to watch videos together remotely on any website",
	icons: {
		"48": context.asset("images/icon-48.png"),
		"96": context.asset("images/icon-96.png")
	},
	permissions: ["tabs", "storage"],
	content_security_policy: {
		extension_pages: CONTENT_SECURITY_POLICY_MAP[context.environment]
	},
	browser_specific_settings: BROWSER_SPECIFIC_SETTINGS_MAP[context.target],
	options_page: context.include("pages/options/+index.pug")
})
