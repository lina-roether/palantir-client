
export default function(context) {
	const exclude = [];
	if (context.target == "firefox") exclude.push("+webextension-polyfill.ts");
	if (context.environment != "debug") {
		exclude.push("pages/ui-preview/+index.pug");
		exclude.push("pages/ui-preview/+styles.scss");
	}
	return { exclude };
}
