export default (context) => ({
	exclude: context.target == "firefox" ? ["+webextension-polyfill.ts"] : []
})
