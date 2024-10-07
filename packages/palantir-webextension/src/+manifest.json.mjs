export default (context) => ({
	manifest_version: 3,
	name: "Palantir",
	version: context.version,
	description: "A browser extension to watch videos together remotely on any website"
		+ (context.environment == "debug" ? " (DEBUG VERSION)" : ""),
	permissions: ["tabs", "storage"],
	action: {
		default_title: "Palantir",
		default_popup: context.include("+popup.pug"),
	},
	background: {
		scripts: [context.include("+background.ts")]
	}
})
