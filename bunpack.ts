import path from 'path'

async function bunBuild() {
    const outDir = path.resolve(__dirname, './extension')
    const contentScript = path.resolve(__dirname, './app/scripts/content/')

    // @ts-ignore
    await Bun.build({
        entrypoints: [contentScript],
        target: 'browser',
        minify: true,
        outdir: outDir,
        naming: '[dir]-script.[ext]',
    })
}

bunBuild()
