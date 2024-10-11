import log from "log";
import * as z from "zod";

const logger = log.get("config");

const ConfigSchema = z.object({
	serverUrl: z.string().url().optional(),
	apiKey: z.string().optional()
})

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: Config = {
	serverUrl: undefined
}

export async function getConfig(): Promise<Config> {
	try {
		logger.info("Reading synchronized config");
		const result = await browser.storage.sync.get({ config: DEFAULT_CONFIG });
		const config = ConfigSchema.parse(result.config);
		logger.debug("Config is %O", config);
		return config;
	} catch (e) {
		logger.error(`Failed to access storage API: ${e?.toString() ?? "Unknown Error"}`);
		return {};
	}
}

export async function setConfig(config: Config): Promise<void> {
	try {
		logger.info("Saving synchronized config");
		logger.debug("Config is %O", config);
		await browser.storage.sync.set({ config });
	} catch (e) {
		logger.error(`Failed to access storage API: ${e?.toString() ?? "Unknown Error"}`);
	}
}
