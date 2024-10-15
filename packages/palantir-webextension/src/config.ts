import log from "@just-log/core";
import * as z from "zod";

const logger = log.sub("config");

const ConfigSchema = z.object({
	username: z.string().optional(),
	serverUrl: z.string().url().optional(),
	apiKey: z.string().optional()
})

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: Config = {
	serverUrl: undefined
}

let cachedConfig: Config | null = null;

async function getConfigCacheMiss(): Promise<Config> {
	let result: Record<string, unknown>;
	try {
		logger.info("Reading synchronized config");
		result = await browser.storage.sync.get({ config: DEFAULT_CONFIG });
	} catch (e) {
		logger.error(`Failed to access storage API: ${e?.toString() ?? "Unknown Error"}`);
		return {};
	}
	let config: Config;
	try {
		config = ConfigSchema.parse(result.config);
		logger.debug(`Config is ${JSON.stringify(config)}`);
	} catch (e) {
		logger.error(`Config is corrupted: ${e?.toString() ?? "Unknown Error"}`);
		config = DEFAULT_CONFIG;
	}
	cachedConfig = config;
	return config;
}

export async function getConfig(): Promise<Config> {
	if (cachedConfig) return cachedConfig;
	return await getConfigCacheMiss();
}

export async function setConfig(config: Config): Promise<void> {
	cachedConfig = null;
	try {
		logger.info("Saving synchronized config");
		logger.debug(`Config is ${JSON.stringify(config)}`);
		await browser.storage.sync.set({ config });
	} catch (e) {
		logger.error(`Failed to access storage API: ${e?.toString() ?? "Unknown Error"} `);
	}
}
