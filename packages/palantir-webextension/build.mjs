import fs from "node:fs/promises";
import path from "node:path"
import swc from "@swc/core";
import * as sass from "sass";
import pug from "pug";
import { Listr } from "listr2";
import log from "log";
import logNode from "log-node";

logNode();

const logger = log.get("build");

const SRC_DIR = path.resolve("src");
const DIST_DIR = path.resolve("dist");

const ENVIRONMENT = process.env.ENVIRONMENT ?? "debug";
const TARGET = process.env.TARGET ?? "firefox";

log.notice("Building for environment %s", ENVIRONMENT);

const ENTRY_POINT_MATCHER = /^\+([^.]+).(.+)$/;
const ENTRY_POINT_TYPES = {
	"ts": "typescript",
	"scss": "scss",
	"pug": "pug",
	"json.mjs": "json_build_esm"
}

function getBundleDistName(name, type) {
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

function getBundle(entry) {
	if (!entry.isFile()) return null;

	const result = ENTRY_POINT_MATCHER.exec(entry.name);
	if (!result) return null;
	const [_, name, extension] = result;
	if (!(extension in ENTRY_POINT_TYPES)) {
		return null;
	}

	const type = ENTRY_POINT_TYPES[extension];
	const input = path.join(entry.parentPath, entry.name);
	const distName = getBundleDistName(name, type);
	const output = path.join(DIST_DIR, distName);
	logger.debug("Found bundle of type %s at %s that will output to %s", type, input, output);
	return {
		srcName: entry.name,
		distName,
		input,
		output,
		type
	};
}

async function getBundles() {
	const distFiles = {};
	const bundles = {};
	logger.debug(`Searching %s for bundles...`, SRC_DIR)
	const srcDir = await fs.opendir(SRC_DIR);
	for await (const entry of srcDir) {
		const bundle = getBundle(entry);
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
		bundles[entry.name] = bundle;
	}
	return bundles;
}

async function buildTypescript(bundle, context) {
	const sourceCode = await fs.readFile(bundle.input, { encoding: "utf-8" });
	logger.debug("Compiling bundle %s with swc", bundle.srcName);
	const output = await swc.transform(sourceCode, {
		filename: bundle.input,
		outputPath: bundle.output,
		sourceMaps: context.environment === "debug",
		isModule: true,
		jsc: {
			parser: {
				syntax: "typescript"
			},
			transform: {},
			minify: context.environment === "debug" ? undefined : {}
		}
	});
	await fs.writeFile(bundle.output, output.code);
}

async function buildScss(bundle, context) {
	logger.debug("Compiling bundle %s with sass", bundle.srcName);
	const compiled = sass.compile(bundle.input, {
		style: context.environment === "debug" ? "expanded" : "compressed"
	});
	await fs.writeFile(bundle.output, compiled.css);
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
	logger.warn("Bulding json files is not yet supported!");
}

async function build(bundle, context) {
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
		logger.debug("Removing %s...", DIST_DIR);
		await fs.rm(DIST_DIR, { recursive: true });
	} catch (e) { }
	logger.debug("Creating %s...", DIST_DIR);
	await fs.mkdir(DIST_DIR);
}

function createContext(bundles) {
	return {
		environment: ENVIRONMENT,
		target: TARGET,
		include(name) {
			if (!name in bundles) {
				throw new Error(`Bundle ${name} doesn't exist!`)
			}
			return bundles[name].distName
		}
	}
}

function createBundleBuildTasks(bundles) {
	const context = createContext(bundles);

	const tasks = [];
	for (const bundle of Object.values(bundles)) {
		tasks.push({
			title: bundle.srcName,
			task: () => build(bundle, context)
		})
	}
	return tasks;
}

function createBuildTaskRunner(bundles) {
	return new Listr(
		[
			{
				title: "Cleanup dist directory",
				task: () => preBuildCleanup()
			},
			{
				title: "Build bundles",
				task: (_, task) => task.newListr(
					createBundleBuildTasks(bundles),
					{
						concurrent: true,
					}
				)
			}
		],
		{
			collectErrors: "minimal",
		}
	)
}

async function main() {
	const bundles = await getBundles();
	const runner = createBuildTaskRunner(bundles);
	try {
		await runner.run();
		for (const error of runner.errors) {
			logger.error(`${error}`);
		}
	} catch(e) {
		logger.error(`Failed to build: ${e}`);
	}
}

await main();
