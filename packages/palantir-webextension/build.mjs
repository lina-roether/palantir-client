import fs from "node:fs/promises";
import path from "node:path"
import swc from "@swc/core";
import log from "log";
import logNode from "log-node";

logNode();

const logger = log.get("build");

const SRC_DIR = path.resolve("src");
const BUNDLES_DIR = path.join(SRC_DIR, "bundles");
const DIST_DIR = path.resolve("dist");

const ENVIRONMENT = process.env.ENVIRONMENT ?? "debug";

log.notice("Building for environment %s", ENVIRONMENT);

async function getBundleNames() {
	const entries = await fs.readdir(BUNDLES_DIR, { withFileTypes: true });
	const bundles = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		bundles.push(entry.name);
	}
	return bundles;
}

async function getOptionalFile(baseDir, filename) {
	const filepath = path.join(baseDir, filename)
	try {
		const indexTs = await fs.stat(filepath);
		if (!indexTs.isFile()) return null;
		return filepath;
	} catch (e) {
		if (e.code !== "ENOENT") {
			console.log(`Cannot access file ${filepath}: ${e}`);
		}
		return null;
	}
}

const TS_ENTRY_POINT = "index.ts";
const PUG_ENTRY_POINT = "index.pug";
const SCSS_ENTRY_POINT = "index.scss";

async function getBundle(name) {
	logger.info("Reading bundle %s", name);
	const baseDir = path.join(BUNDLES_DIR, name);
	return {
		name,
		baseDir,
		entryPoints: {
			ts: await getOptionalFile(baseDir, TS_ENTRY_POINT),
			pug: await getOptionalFile(baseDir, PUG_ENTRY_POINT),
			scss: await getOptionalFile(baseDir, SCSS_ENTRY_POINT)
		}
	}
}

async function buildTs(bundleName, entryPoint, outDir) {
	const outFileName = `${bundleName}.js`

	const outFile = path.join(outDir, outFileName);

	const sourceCode = await fs.readFile(entryPoint, { encoding: "utf-8" });
	const output = await swc.transform(sourceCode, {
		filename: entryPoint,
		outputPath: outFile,
		sourceMaps: ENVIRONMENT === "debug",
		isModule: true,
		jsc: {
			parser: {
				syntax: "typescript"
			},
			transform: {},
			minify: ENVIRONMENT === "debug" ? undefined : {}
		}
	});
	logger.debug("Outputting compiled javascript for %s to %s", entryPoint, outFile);
	await fs.writeFile(outFile, output.code);

	logger.notice("Built %s", outFileName);
	return outFile;
}

async function buildScss(bundleName, entryPoint, outDir) {
	logger.warning("Building scss files is not supported yet!")
	return null;
}

async function buildPug(bundleName, entryPoint, outDir, files) {
	logger.warning("Building pug files is not supported yet!")
	return null;
}

async function build(bundle) {
	logger.notice("Building %s...", bundle.name);
	const files = {
		js: null,
		css: null,
		html: null
	};
	if (bundle.entryPoints.ts) {
		files.js = await buildTs(bundle.name, bundle.entryPoints.ts, DIST_DIR);
	}
	if (bundle.entryPoints.scss) {
		files.css = await buildScss(bundle.name, bundle.entryPoints.scss, DIST_DIR);
	}
	if (bundle.entryPoints.pug) {
		files.html = await buildPug(bundle.name, bundle.entryPoints.pug, DIST_DIR, files);
	}
	logger.notice("Finished building %s", bundle.name);
	return files;
}

async function* iterBundles() {
	const names = await getBundleNames();
	for (const name of names) yield await getBundle(name);
}
async function preBuildCleanup() {
	try {
		logger.debug("Removing %s...", DIST_DIR);
		await fs.rm(DIST_DIR, { recursive: true });
	} catch (e) { }
	logger.debug("Creating %s...", DIST_DIR);
	await fs.mkdir(DIST_DIR);
}


async function buildBundles() {
	await preBuildCleanup();
	for await (const bundle of iterBundles()) {
		await build(bundle);
	}
}

await buildBundles();
