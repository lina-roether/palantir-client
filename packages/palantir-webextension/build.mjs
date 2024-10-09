import fs from "node:fs/promises";
import path from "node:path";
import esbuild from "esbuild";
import * as sass from "sass";
import pug from "pug";
import { Listr } from "listr2";
import log from "log";
import logNode from "log-node";

logNode();

const logger = log.get("build");

const SRC_DIR = path.resolve("src");
const ASSETS_DIR = path.resolve("assets");
const DIST_DIR = path.resolve("dist");
const BUILD_CONFIG_FILE = path.resolve("+build_config.mjs");

const ENVIRONMENT = process.env.ENVIRONMENT ?? "debug";
const TARGET = process.env.TARGET ?? "firefox";
const VERSION = process.env.npm_package_version;

const BUILD_NAME = ENVIRONMENT === "debug" ? `${TARGET}-debug` : `${TARGET}`;
const OUTPUT_DIR = path.join(DIST_DIR, BUILD_NAME);
const ASSETS_DIST_NAME = "assets";
const ASSETS_OUTPUT_DIR = path.join(OUTPUT_DIR, ASSETS_DIST_NAME);

if (!VERSION) {
	logger.error("Failed to load package version");
	process.exit(1);
}

log.notice("Building version %s of %s", VERSION, BUILD_NAME);

const ENTRY_POINT_MATCHER = /^\+([^.]+).(.+)$/;
const ENTRY_POINT_TYPES = {
	"ts": "typescript",
	"scss": "scss",
	"pug": "pug",
	"json.mjs": "json_build_esm"
}

function getBundleFileName(name, type) {
	switch (type) {
		case "typescript":
			return `${name}.js`
		case "scss":
			return `${name}.css`
		case "pug":
			return `${name}.html`
		case "json_build_esm":
			return `${name}.json`
		default:
			throw new Error(`Unexpected bundle type '${type}'`);
	}
}

async function getBuildConfig(globalContext) {
	try {
		await fs.stat(BUILD_CONFIG_FILE);
	} catch (e) {
		if (e.code !== "ENOENT") logger.error(`Failed to access build config: ${e}`);
		return {};
	}
	logger.debug("Reading build config from %s", BUILD_CONFIG_FILE);
	const mod = await import(BUILD_CONFIG_FILE);
	let value;
	switch (typeof mod.default) {
		case "function":
			value = mod.default(globalContext);
			break;
		case "object":
			value = mod.default;
			break;
		default:
			throw new Error(`Expected either object or function as default export from build config, but got ${typeof mod}`);
	}
	logger.debug("Build config is %O", value);
	return value;
}

function getBundle(entry, baseDir) {
	if (!entry.isFile()) return null;

	const result = ENTRY_POINT_MATCHER.exec(entry.name);
	if (!result) return null;
	const [_, name, extension] = result;
	if (!(extension in ENTRY_POINT_TYPES)) {
		return null;
	}

	const type = ENTRY_POINT_TYPES[extension];
	const input = path.join(entry.parentPath, entry.name);
	const distName = path.join(baseDir, getBundleFileName(name, type));
	const srcName = path.join(baseDir, entry.name);
	const output = path.join(OUTPUT_DIR, distName);
	logger.debug("Found bundle of type %s at %s that will output to %s", type, input, output);
	return {
		srcName,
		distName,
		input,
		output,
		type
	};
}

async function getBundlesRecursive(bundles, distFiles, baseDir) {
	logger.debug(`Searching %s for bundles...`, baseDir)
	const srcDir = await fs.opendir(path.join(SRC_DIR, baseDir));
	for await (const entry of srcDir) {
		if (entry.isDirectory()) {
			await getBundlesRecursive(bundles, distFiles, path.join(baseDir, entry.name));
		}

		const bundle = getBundle(entry, baseDir);
		if (!bundle) continue;

		if (bundle.distName in distFiles) {
			const conflictBundle = distFiles[bundle.distName];
			logger.error(
				"Failed to resolve bundle %s: file %s is already produced by bundle %s",
				bundle.srcName,
				bundle.distName,
				conflictBundle.srcName
			);
			continue;
		}
		distFiles[bundle.distName] = bundle;
		bundles[bundle.srcName] = bundle;
	}
}

async function getBundles() {
	const distFiles = {};
	const bundles = {};
	await getBundlesRecursive(bundles, distFiles, "")
	return bundles;
}

async function buildTypescript(bundle, context) {
	logger.debug("Compiling bundle %s with swc", bundle.srcName);

	await esbuild.build({
		entryPoints: [bundle.input],
		outfile: bundle.output,
		bundle: true,
		sourcemap: context.environment === "debug",
		format: "iife",
		minify: context.environment === "prod",
	})
}

async function buildScss(bundle, context) {
	logger.debug("Compiling bundle %s with sass", bundle.srcName);
	const compiled = sass.compile(bundle.input, {
		style: context.environment === "debug" ? "expanded" : "compressed",
		sourceMap: context.environment === "debug"
	});
	let cssContent = compiled.css;

	if (compiled.sourceMap) {
		logger.debug("Found source maps for %s", bundle.distName);
		const sourceMapName = `${bundle.distName}.map`;
		const sourceMapOutput = path.join(OUTPUT_DIR, sourceMapName);
		cssContent += `\n/*# sourceMappingURL=${sourceMapName}*/`;
		await fs.writeFile(sourceMapOutput, JSON.stringify(compiled.sourceMap));
	}

	await fs.writeFile(bundle.output, cssContent);
}

async function buildPug(bundle, context) {
	const sourceCode = await fs.readFile(bundle.input, { encoding: "utf-8" });

	logger.debug("Compiling template %s with pug", bundle.srcName);
	const template = pug.compile(sourceCode, {
		filename: bundle.input,
		basedir: SRC_DIR,
		compileDebug: context.environment === "debug"
	});

	const html = template(context);

	await fs.writeFile(bundle.output, html);
}

async function buildJsonEsm(bundle, context) {
	logger.debug("Evaluating json generator %s", bundle.srcName);
	const mod = await import(bundle.input);
	let value;
	switch (typeof mod.default) {
		case "function":
			value = mod.default(context);
			break;
		case "object":
			value = mod.default;
			break;
		default:
			throw new Error(`Expected either object or function as default export from json builder module, but got ${typeof mod}`);
	}
	const json = JSON.stringify(value, null, context.environment === "debug" ? 3 : null);
	await fs.writeFile(bundle.output, json);
}

async function build(bundle, globalContext, config) {
	const exclude = config.exclude ?? [];
	if (exclude.includes(bundle.srcName)) {
		logger.notice("%s is excluded for this build", bundle.srcName);
		return;
	}
	const context = createBundleContext(globalContext, bundle);
	await fs.mkdir(path.dirname(bundle.output), { recursive: true });
	switch (bundle.type) {
		case "typescript":
			await buildTypescript(bundle, context);
			break;
		case "scss":
			await buildScss(bundle, context);
			break;
		case "pug":
			await buildPug(bundle, context);
			break;
		case "json_build_esm":
			await buildJsonEsm(bundle, context);
			break;
		default:
			throw new Error(`Unexpected bundle type '${type}'`);
	}
}

async function preBuildCleanup() {
	try {
		logger.debug("Removing %s...", OUTPUT_DIR);
		await fs.rm(OUTPUT_DIR, { recursive: true });
	} catch (e) { }
	logger.debug("Creating %s...", OUTPUT_DIR);
	await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function copyAssets() {
	try {
		const stat = await fs.stat(ASSETS_DIR);
		if (!stat.isDirectory()) return;
	} catch (e) {
		if (e.code !== "ENOENT") logger.error(`${e}`);
		return;
	}
	await fs.mkdir(ASSETS_OUTPUT_DIR)
	logger.debug("Copying assets...");
	await fs.cp(ASSETS_DIR, ASSETS_OUTPUT_DIR, { recursive: true });
}

function createGlobalContext(bundles) {
	return {
		environment: ENVIRONMENT,
		target: TARGET,
		version: VERSION,
		bundles,
		asset(name) {
			return `/${path.join(ASSETS_DIST_NAME, name)}`;
		},
		include(name) {
			if (!(name in bundles)) {
				throw new Error(`Bundle ${name} doesn't exist!`)
			}
			console.log(name, bundles[name]);
			return `/${bundles[name].distName}`;
		},
	}
}

function createBundleContext(globalContext, _bundle) {
	return {
		...globalContext,
	}
}

async function createBundleBuildTasks(bundles) {
	const globalContext = createGlobalContext(bundles);
	const config = await getBuildConfig(globalContext);

	const tasks = [];
	for (const bundle of Object.values(bundles)) {
		tasks.push({
			title: bundle.srcName,
			task: () => build(bundle, globalContext, config)
		})
	}
	return tasks;
}

async function createBuildTaskRunner(bundles) {
	const buildTasks = await createBundleBuildTasks(bundles);

	return new Listr(
		[
			{
				title: "Cleanup dist directory",
				task: () => preBuildCleanup()
			},
			{
				title: "Build bundles",
				task: (_, task) => task.newListr(
					buildTasks,
					{
						concurrent: true,
					}
				)
			},
			{
				title: "Copy assets",
				task: () => copyAssets(),
			}
		],
		{
			collectErrors: "minimal",
		}
	)
}

async function main() {
	const bundles = await getBundles();
	const runner = await createBuildTaskRunner(bundles);
	try {
		await runner.run();
		for (const error of runner.errors) {
			logger.error(`${error}`);
		}
	} catch (e) {
		logger.error(`Failed to build: ${e}`);
	}
}

await main();
