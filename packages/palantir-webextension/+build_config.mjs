
export default function(context) {
	const exclude = [];
	if (context.target == "firefox") {
		exclude.push("background/+polyfilled.ts");
		exclude.push("+webextension-polyfill.mjs");
	}
	if (context.target == "chromium") {
		exclude.push("background/+index.ts");
	}
	if (context.environment != "debug") {
		exclude.push("pages/ui-preview/+index.pug");
		exclude.push("pages/ui-preview/+styles.scss");
	}
	return { exclude };
}
