import { default as initCompiler } from './compiler.js'
import {Iota, BooleanIota, ListIota, NullIota, NumberIota, PatternIota, VectorIota, StringIota} from './iotas.js'
import { stripString } from './shared.js'

async function build() {
    const compiler = await initCompiler()
    const iota = new ListIota([])
    const resp = await fetch('library.hexpattern')
    if (resp.status !== 200) {
        throw new Error(`Failed to read library: ${resp.status} ${resp.statusText}`)
    }
    const library = await resp.text()
    let target = ["__fallback"]
    let builder: Iota[] = []
    for (let line of library.split('\n')) {
        line = stripString(line)
        const newFileTester = /^\/\/ :: (.*)$/
        const aliasTester = /^\/\/ \+: (.*)$/
        if (newFileTester.test(line)) {
            const resul = newFileTester.exec(line)![1]
            console.log('new', resul)
            // WRITE the previous entry...
            if (builder.length > 0) {
                for (const nameOrAlias of target) {
                    console.debug('Writing', nameOrAlias, 'with', builder.length, 'patterns')
                    const iota1 = new StringIota(nameOrAlias)
                    const iota2 = new ListIota(builder)
                    iota.data.push(iota1, iota2)
                }
            } else if (target.includes('__fallback')) {
                console.info('Fallback function has no patterns, skipping')
            } else {
                console.warn(`Empty function definition for ${target.join(' and ')}, skipping`)
            }
            // ...and start a new one
            target = [resul]
            builder = []
        } else if (aliasTester.test(line)) {
            const resul = aliasTester.exec(line)![1]
            console.log('alias', resul)
            target.push(resul)
        } else if (line.startsWith('//')) {

        } else {
            const i = await compiler.iotafy(line)
            if (i !== null) {
                builder = builder.concat(i.map(x => x.toIota()))
            }
        }
    }
    if (builder.length > 0) {
        // Write the final entry
        for (const nameOrAlias of target) {
            console.debug('Writing', nameOrAlias, 'with', builder.length, 'patterns')
            const iota1 = new StringIota(nameOrAlias)
            const iota2 = new ListIota(builder)
            iota.data.push(iota1, iota2)
        }
    } else {
        console.warn(`Empty function definition for ${target.join(' and ')}, skipping`)
    }
    return iota
}

async function buildExport() {
    let iota = await build()
    return `give @p hexcasting:focus{data:${iota.asNBT()}}`
}

declare global {
    interface Window {
        buildLib: typeof buildExport,
        buildLibRaw: typeof build,
    }
}
window.buildLib = buildExport
window.buildLibRaw = build

export {
    build
}