import * as z from "zod";
import { baseLogger } from "./logger";

const logger = baseLogger.sub("options");

const OptionsSchema = z.object({
	username: z.string().optional(),
	serverUrl: z.string().url().optional(),
	apiKey: z.string().optional()
})

export type Options = z.infer<typeof OptionsSchema>;

const DEFAULT_OPTIONS: Options = {
	serverUrl: undefined
}

let cachedOptions: Options | null = null;

async function getOptionsCacheMiss(): Promise<Options> {
	let result: Record<string, unknown>;
	try {
		logger.info("Reading synchronized options");
		result = await browser.storage.sync.get({ options: DEFAULT_OPTIONS });
	} catch (e) {
		logger.error(`Failed to access storage API: ${e?.toString() ?? "Unknown Error"}`);
		return {};
	}
	let options: Options;
	try {
		options = OptionsSchema.parse(result.options);
		logger.debug(`Options are ${JSON.stringify(options)}`);
	} catch (e) {
		logger.error(`Options are corrupted: ${e?.toString() ?? "Unknown Error"}`);
		options = DEFAULT_OPTIONS;
	}
	cachedOptions = options;
	return options;
}

export async function getOptions(): Promise<Options> {
	if (cachedOptions) return cachedOptions;
	return await getOptionsCacheMiss();
}

export async function setOptions(options: Options): Promise<void> {
	cachedOptions = null;
	try {
		logger.info("Saving synchronized options");
		logger.debug(`Options are ${JSON.stringify(options)}`);
		await browser.storage.sync.set({ options });
	} catch (e) {
		logger.error(`Failed to access storage API: ${e?.toString() ?? "Unknown Error"} `);
	}
}

export function invalidateCachedOptions() {
	cachedOptions = null;
}
