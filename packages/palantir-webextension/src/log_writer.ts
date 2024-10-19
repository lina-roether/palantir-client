import initLogWriter from "@just-log/browser";

initLogWriter({
	maxLevel: import.meta.env.environment == "debug" ? 4 /* DEBUG */ : 3 /* INFO */
});
