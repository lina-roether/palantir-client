import * as z from "zod";
import { baseLogger } from "./logger";

const logger = baseLogger.sub("options");

const OptionsSchema = z.object({
	username: z.string().optional(),
	serverUrl: z.string().url().optional(),
	apiKey: z.string().optional()
})

export type PartialOptions = z.infer<typeof OptionsSchema>;

export interface Options extends PartialOptions {
	username: string,
	serverUrl: string
}

function optionsComplete(options: PartialOptions): options is Options {
	return options.username !== undefined && options.serverUrl !== undefined;
}

const DEFAULT_OPTIONS: PartialOptions = {}

let cachedOptions: PartialOptions | null = null;

async function getPartialOptionsCacheMiss(): Promise<PartialOptions> {
	let result: Record<string, unknown>;
	try {
		logger.info("Reading synchronized options");
		result = await browser.storage.sync.get({ options: DEFAULT_OPTIONS });
	} catch (e) {
		logger.error(`Failed to access storage API`, e);
		return {};
	}
	let options: PartialOptions;
	try {
		options = OptionsSchema.parse(result.options);
		logger.debug(`Options are ${JSON.stringify(options)}`);
	} catch (e) {
		logger.error(`Options are corrupted`, e);
		options = DEFAULT_OPTIONS;
	}
	cachedOptions = options;
	return options;
}

async function getPartialOptions(): Promise<PartialOptions> {
	if (cachedOptions) return cachedOptions;
	return await getPartialOptionsCacheMiss();
}

export async function getOptions(): Promise<Options | null> {
	const options = await getPartialOptions();
	if (!optionsComplete(options)) return null;
	return options;
}

export async function setOptions(options: PartialOptions): Promise<void> {
	cachedOptions = null;
	try {
		logger.info("Saving synchronized options");
		logger.debug(`Options are ${JSON.stringify(options)}`);
		await browser.storage.sync.set({ options });
	} catch (e) {
		logger.error(`Failed to access storage API`, e);
	}
}

export function invalidateCachedOptions() {
	cachedOptions = null;
}
