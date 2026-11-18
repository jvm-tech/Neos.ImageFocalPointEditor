const esbuild = require('esbuild');
const extensibilityMap = require("@neos-project/neos-ui-extensibility/extensibilityMap.json");
const isWatch = process.argv.includes('--watch');
const styleLoader = require('esbuild-style-loader');

// Neos UI 9 no longer exposes plow-js in the host plugin API, so it is bundled instead of aliased.
const { "plow-js": hostPlowJs, ...alias } = extensibilityMap;

/** @type {import("esbuild").BuildOptions} */
const options = {
    logLevel: "info",
    bundle: true,
    target: "es2020",
    entryPoints: { "Plugin": "src/index.ts" },
    // add this loader mapping,
    // in case youre "missusing" javascript files as typescript-react files
    // - eg with `@neos` or `@connect` decorators
    loader: { ".js": "tsx" },
    outdir: "../../Public/ImageFocalPointEditor",
    alias,
    legalComments: "none",
    minify: !isWatch,
    plugins: [
        styleLoader.styleLoader({})
    ],
}

if (isWatch) {
    esbuild.context(options).then((ctx) => ctx.watch())
} else {
    esbuild.build(options)
}
