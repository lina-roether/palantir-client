import { snackbar } from "../../fragments/components";
import { baseLogger } from "../../logger";
import { assertElement } from "../../utils/query";

const logger = baseLogger.sub("pages", "ui_preview");

const openInfoSnackbar = assertElement(logger, "#ui-preview__open-info-snackbar", HTMLElement);
const openErrorSnackbar = assertElement(logger, "#ui-preview__open-error-snackbar", HTMLElement);

openInfoSnackbar.addEventListener("click", () => {
	snackbar.queueSnackbar({
		type: snackbar.SnackbarType.INFO,
		message: "This is an info snackbar!"
	})
});

openErrorSnackbar.addEventListener("click", () => {
	snackbar.queueSnackbar({
		type: snackbar.SnackbarType.ERROR,
		message: "This is an error snackbar!"
	})
});
