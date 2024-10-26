const EXTENSION_ID = "{cbaa7c2d-7a63-4d10-bcca-1de052432aa0}";

function per_environment(context, map) {
	return map[context.environment];
}

function per_target(context, map) {
	return map[context.target];
}

export default (context) => ({
	manifest_version: 3,
	name: per_environment(context, {
		prod: "Palantir",
		debug: "Palantir (DEBUG)"
	}),
	version: context.version,
	description: "A browser extension to watch videos together remotely on any website",
	icons: {
		"48": context.asset("images/icon-48.png"),
		"96": context.asset("images/icon-96.png")
	},
	permissions: ["tabs", "storage"],
	content_security_policy: {
		extension_pages: per_environment(context, {
			prod: "default-src 'self'; upgrade-insecure-requests; connect-src ws: wss:",
			debug: "default-src 'self'; connect-src ws: wss:"
		})
	},
	browser_specific_settings: per_target(context, {
		firefox: {
			gecko: {
				id: EXTENSION_ID
			}
		}
	}),
	action: {
		default_icon: {
			"16": context.asset("images/icon-16.png"),
			"24": context.asset("images/icon-24.png"),
			"48": context.asset("images/icon-48.png")
		},
		default_title: "Palantir",
		default_popup: context.include("pages/popup/+index.pug"),
	},
	options_ui: {
		page: context.include("pages/options/+index.pug")
	},
	background: per_target(context, {
		firefox: {
			scripts: [context.include("background/+index.ts")]
		},
		chromium: {
			service_worker: context.include("background/+polyfilled.ts")
		}
	}),
	protocol_handlers: [
		{
			protocol: "ext+palantir",
			name: "Palantir",
			uriTemplate: `${context.include("pages/action/+index.pug")}#%s`
		}
	]
})
