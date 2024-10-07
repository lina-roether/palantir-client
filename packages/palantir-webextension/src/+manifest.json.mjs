export default (context) => ({
	test: "123",
	file: context.include("+popup.pug")
})
