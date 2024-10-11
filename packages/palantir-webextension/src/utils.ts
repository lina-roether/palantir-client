import log from "log";

const logger = log.get("utils");

export function assertElement(query: string, rootElem: Element = document.body): Element {
	const elem = rootElem.querySelector(query);
	if (!elem) {
		throw new Error(`Missing expected element '${query}'`);
	}
	return elem;
}

export function assertTypedElement<E extends Element>(query: string, runtimeType: new () => E, rootElem: Element = document.body): E {
	const elem = assertElement(query, rootElem);
	if (!(elem instanceof runtimeType)) {
		const expectedTypeName = runtimeType.name;
		const receivedTypeName = elem.constructor.name;
		throw new Error(`Expected element ${query} to be of type ${expectedTypeName}, but found ${receivedTypeName}`);
	}
	return elem;
}

export function initComponent<E extends Element>(query: string, runtimeType: new () => E, handler: (elem: E) => void, cleanup?: (elem: E) => void) {
	const initialElems = document.querySelectorAll(query);
	for (const elem of initialElems) {
		if (!(elem instanceof runtimeType)) {
			logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
			continue;
		}
		handler(elem);
	}

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const addedNode of record.addedNodes) {
				if (!(addedNode instanceof Element)) continue;
				if (!addedNode.matches(query)) continue;
				if (!(addedNode instanceof runtimeType)) {
					logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
					continue;
				}
				handler(addedNode);
			}
			if (!cleanup) return;
			for (const removedNode of record.removedNodes) {
				if (!(removedNode instanceof Element)) continue;
				if (!removedNode.matches(query)) continue;
				if (!(removedNode instanceof Element)) continue;
				if (!removedNode.matches(query)) continue;
				if (!(removedNode instanceof runtimeType)) {
					logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
					continue;
				}
				cleanup(removedNode);
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
}


export const enum FormMode {
	SUBMIT,
	EDIT,
}

export type FormFieldValue = FormDataEntryValue | boolean | null;

export interface FormFieldOptions {
	value?: FormFieldValue | (() => Promise<FormFieldValue> | FormFieldValue);
	validate?: (value: FormDataEntryValue | null) => string | undefined;
}

export interface FormOptions<F extends string> {
	query: string;
	mode?: FormMode;
	onSubmit?: (data: FormData) => void;
	fields: Partial<Record<F, FormFieldOptions>>;
}

export type FormValues<F extends string> = Partial<Record<F, FormFieldValue | (() => Promise<FormFieldValue> | FormFieldValue)>>;

export interface FormManager<F extends string> {
	set(values: FormValues<F>): Promise<void>;
	reset(): Promise<void>;
}

interface FieldValidationState {
	changed: boolean;
	valid: boolean;
}

export async function initForm<F extends string>(options: FormOptions<F>, rootElem: Element = document.body): Promise<FormManager<F>> {
	const form = assertTypedElement(options.query, HTMLFormElement, rootElem);
	const initialValues: FormValues<F> = {};
	for (const fieldName in options.fields) {
		const valueOrGetter = options.fields[fieldName]?.value;
		const value = typeof valueOrGetter === "function" ? await valueOrGetter() : valueOrGetter;
		initialValues[fieldName] = value;
	}

	async function set(values: FormValues<F>) {
		for (const fieldName in values) {
			const value: FormFieldValue | undefined = typeof values[fieldName] === "function" ? await values[fieldName]() : values[fieldName];
			if (value === undefined) continue;

			const input = form.elements.namedItem(fieldName);

			if (!input) {
				logger.error("Form has no field with name %s", fieldName);
				continue;
			}
			if (!(input instanceof HTMLInputElement)) {
				logger.error("Form field had unexpected type: %s", input.constructor.name);
				continue;
			}
			if (input.type === "checkbox") {
				if (typeof value !== "boolean") {
					logger.error("Cannot assign value %o to field %s: Only boolean values can be assigned to checkboxes", value, fieldName);
					continue;
				}
				input.checked = value;
			} else {
				if (typeof value !== "string") {
					logger.error("Cannot assign value %o to field %s: Only string values can be assigned to generic input elements", value, fieldName);
					continue;
				}
				input.value = value;
			}
			input.dispatchEvent(new CustomEvent("change", { detail: { formSynthetic: true } }));
		}
	}

	async function reset() {
		await set(initialValues);
	}

	const submitElements = form.querySelectorAll(`input[type="submit"], button[type"submit"]`);
	const validationState: Record<string, FieldValidationState> = {};

	function computeCanSubmit() {
		const isValid = Object.values(validationState).every((state) => state.valid);
		if (!isValid) return false;

		if (options.mode === FormMode.EDIT) {
			const isChanged = Object.values(validationState).some((state) => state.changed);
			if (!isChanged) return false;
		}

		return true;
	}

	function setSubmitButtonState() {
		const canSubmit = computeCanSubmit();
		for (const submitButton of submitElements) {
			if (!(submitButton instanceof HTMLButtonElement) || !(submitButton instanceof HTMLInputElement)) continue;
			submitButton.disabled = !canSubmit;
		}
	}

	for (const fieldName in form.elements) {
		const input = form.elements[fieldName];
		const initialValue = initialValues[fieldName as F];
		if (!(input instanceof HTMLInputElement)) continue;

		const validator = options.fields[fieldName as F]?.validate;
		if (validator) {
			input.setCustomValidity(validator(input.value) ?? "");
		}

		validationState[fieldName] = {
			changed: false,
			valid: input.checkValidity()
		}

		let updateEvent;
		switch (input.type) {
			case "checkbox":
				updateEvent = "change"
				break;
			case "text":
			default:
				updateEvent = "input"
		}

		input.addEventListener(updateEvent, () => {
			let changed = false;
			if (input.type === "checkbox") {
				changed = input.checked !== initialValue;
			} else {
				changed = input.value !== initialValue;
			}
			if (changed) input.setAttribute("changed", "");
			else input.removeAttribute("changed");
			validationState[fieldName] = {
				changed,
				valid: input.checkValidity()
			}
			setSubmitButtonState();
		});
	}

	form.addEventListener("submit", (evt) => {
		evt.preventDefault();
		const data = new FormData(form);
		options.onSubmit?.(data);
	});

	// initial setup
	void reset();
	setSubmitButtonState();

	return { set, reset };
}
