import { Pattern, Direction, directions } from './shared.js'
import { default as initCompiler } from './compiler.js'

;(function() {
    let compilerItems: Awaited<ReturnType<typeof initCompiler>>
    const yield_ = () => new Promise((resolve, reject) => setTimeout(resolve, 0))
    const nocache = true
    function setStatusMessage(message: string) {
        document.getElementById('status')!.textContent = message
    }
    function setStatistics(message: string) {
        document.getElementById('statistics')!.textContent = message
    }
    console.log = (() => {
        const original = console.log
        return (...args: any[]) => {
            original(...args)
            const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')
            const el = document.createElement('div')
            el.textContent = message
            const log = document.getElementById('log')!
            log.appendChild(el)
            log.scrollTop = log.scrollHeight
        }
    })()

    class Pattern {
        constructor(public direction: Direction, public pattern: string) {}
        public extend(extension: string) {
            return new Pattern(this.direction, this.pattern + extension)
        }
    }

    type HexPackageSpec = {
        entrypoint: string
    }
    let cachedSources = new Map<string, string>()
    let cachedProcessed = new Map<string, string>()

    async function loadHexPackage() {
        setStatusMessage('Loading hexpackage.json')
        const resp = await fetch('hexpackage.json', {cache: 'no-store'})
        const data = await resp.json()
        return data as HexPackageSpec
    }
    async function getOrCache(path: string): Promise<string> {
        if (cachedSources.has(path)) {
            const text = cachedSources.get(path)!
            console.log('fetch:', path, text.length, '(cached)')
            return text
        }
        setStatusMessage(`Loading ${path}`)
        const resp = await fetch(path, {
            cache: nocache ? 'no-store' : 'default'
        })
        const text = await resp.text()
        cachedSources.set(path, text)
        console.log('fetch:', path, text.length)
        return text
    }

    type SupportedExtension = 'hexpattern' | 'hexcasting' | 'hexiota'
    async function translatePatterns(content: string, targetExtension: SupportedExtension) {
        const translators: {[key in SupportedExtension]: (content: string) => Promise<string>} = {
            hexpattern: async content => content,
            hexcasting: async content => content,
            hexiota: async content => {
                let translated: string[] = []
                let n = 0
                const totalCount = content.split('\n').length
                let lastYield = Date.now()
                for (const line of content.split('\n')) {
                    n++
                    setStatusMessage(`Translating: ${Math.round(n/totalCount*100)}% ${n} / ${totalCount}`)
                    translated.push((await compilerItems!.translatePattern(line, setStatusMessage)))
                    if (Date.now() - lastYield > 25) {
                        await yield_()
                        lastYield = Date.now()
                    }
                }
                return translated.join('\n')
            }
        }
        return await translators[targetExtension](content)
    }

    async function processFile(path: string, recurStack: string[] = []) {
        await yield_()
        if (recurStack.includes(path)) {
            console.log("Circular #include detected: ", recurStack.join(' -> '), '->', path)
            setStatusMessage(`Build failed`)
            throw new Error(`Circular #include detected: ${recurStack.join(' -> ')} -> ${path}`)
        }
        if (cachedProcessed.has(path)) {
            const val = cachedProcessed.get(path)!
            console.log('reusing', path, `(${val.length})`)
            return val
        }
        let content = await getOrCache(path)
        const originalContent = content
        while (true) {
            const match = /^[ \t]*\/\/#include (.*)$/gm.exec(content)
            if (!match) break
            const includePath = match[1]
            const includeContent = await processFile(includePath, [...recurStack, path])
            content = content.slice(0, match.index!) + includeContent + content.slice(match.index! + match[0].length)
        }

        // erase comments and extraneous newlines
        content = content.replace(/\/\/.*$/gm, '')
        content = content.replace(/(\s*\n)+/gm, '\n')
        console.log('processed', path, originalContent.length, '->', content.length, `(${Math.round(content.length / originalContent.length * 100)}%)`)
        cachedProcessed.set(path, content)
        return content
    }

    async function load() {
        setStatusMessage(`Initializing compiler...`)
        compilerItems = await initCompiler()
        const start = Date.now()
        let packageInfo = await loadHexPackage()
        let built = await processFile(packageInfo.entrypoint)
        built = await translatePatterns(built, 'hexiota')
        const end = Date.now()
        setStatusMessage(`Build completed.`)
        setStatistics(`output ${built.length} bytes in ${end-start}ms, fetched ${cachedSources.size} things, processed ${cachedProcessed.size} files`)
        document.getElementById('target')!.textContent = built
    }

    window.addEventListener('load', load)
})()