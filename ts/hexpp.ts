import { Pattern, Direction, directions, stripString, nodify } from './shared.js'
import { default as initCompiler } from './compiler.js'
import './export_give.js'
import './build_lib.js'
import { Iota } from './iotas.js'

(function () {
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
        constructor(public direction: Direction, public pattern: string) { }
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
        const resp = await fetch('hexpackage.json', { cache: 'no-store' })
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
        if (resp.status !== 200) {
            throw new Error(`Failed to fetch ${path}: ${resp.status} ${resp.statusText}`)
        }
        const text = await resp.text()
        cachedSources.set(path, text)
        console.log('fetch:', path, text.length)
        return text
    }

    type SupportedExtension = 'hexpattern' | 'hexcasting' | 'hexiota'
    type UniqueExtensions = 'hexcasting' | 'hexiota'
    async function translatePatterns(content: string, sourceExtension: SupportedExtension, targetExtension: SupportedExtension) {
        if (sourceExtension === 'hexpattern') sourceExtension = 'hexcasting'
        if (targetExtension === 'hexpattern') targetExtension = 'hexcasting'
        if (sourceExtension !== targetExtension) console.log('Translating', sourceExtension, 'to', targetExtension)
        sourceExtension = sourceExtension as UniqueExtensions
        targetExtension = targetExtension as UniqueExtensions
        // translators.source.target
        const translators: { [key in UniqueExtensions]: { [key in UniqueExtensions]: (content: string) => Promise<string> } } = {
            hexcasting: {
                hexcasting: async content => content,
                hexiota: async content => {
                    let translated: string[] = []
                    let n = 0
                    const totalCount = content.split('\n').length
                    const start = Date.now()
                    let lastYield = Date.now()
                    for (const line of content.split('\n')) {
                        n++
                        setStatusMessage(`Translating: ${Math.round(n / totalCount * 100)}% ${n} / ${totalCount}`)
                        const partial = await compilerItems!.translatePattern(line)
                        if (!partial.match(/^\s*$/gm))
                            translated.push('<' + partial + '>')
                        if (Date.now() - lastYield > 25) {
                            await yield_()
                            lastYield = Date.now()
                        }
                    }
                    console.log('translated', translated.length, 'lines in', Date.now() - start, 'ms')
                    return `[${translated.join(',')}]`
                }
            },
            hexiota: {
                hexcasting: async content => {
                    throw new Error('cannot translate: hexiota -> hexcasting not implemented')
                },
                hexiota: async content => content,
            }
        }
        const translator = translators[sourceExtension][targetExtension]
        return await translator(content)
    }

    type DirectiveRules = {
        include?: RegExp,
        buildvar?: RegExp
    }

    const directiveRules: { [key in SupportedExtension]: DirectiveRules } = {
        hexpattern: {
            include: /^[ \t]*\/\/#include (.*?)(?:$|;)/gm,
            buildvar: /\/\/#buildvar (.*?)(?:$|;)/gm,
        },
        hexcasting: {
            include: /^[ \t]*\/\/#include (.*?)(?:$|;)/gm,
            buildvar: /\/\/#buildvar (.*?)(?:$|;)/gm,
        },
        hexiota: {
            include: /^[ \t]*#include (.*?)(?:$|;)/gm,
            buildvar: /#buildvar (.*?)(?:$|;)/gm,
        }
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
        const language = path.split('.').pop() as SupportedExtension
        const rules = directiveRules[language]
        if (!rules) {
            throw new Error(`Unsupported language: ${language}`)
        }

        let content = await getOrCache(path)
        const originalContent = content
        // process #includes
        if (rules.include) {
            while (new RegExp(rules.include).test(content)) {
                const match = new RegExp(rules.include).exec(content)!
                const includePath = stripString(match[1])
                const sourceLanguage = includePath.split('.').pop() as SupportedExtension
                const includeContent = await processFile(includePath, [...recurStack, path])
                const translatedContent = await translatePatterns(includeContent, sourceLanguage, language)
                setStatusMessage(`Merging ${path} <- ${includePath}`)
                content = content.slice(0, match.index!) + translatedContent + content.slice(match.index! + match[0].length)
            }
        }

        // erase comments and extraneous newlines
        content = content.replace(/\/\/.*$/gm, '')
        content = content.replace(/(\s*\n)+/gm, '\n')
        console.log('processed', path, originalContent.length, '->', content.length, `(${Math.round(content.length / originalContent.length * 100)}%)`)
        cachedProcessed.set(path, content)
        return content
    }

    async function load() {
        try {
            setStatusMessage(`Initializing compiler...`)
            compilerItems = await initCompiler()
            const start = Date.now()
            let packageInfo = await loadHexPackage()
            let built = await processFile(packageInfo.entrypoint)
            const end = Date.now()
            setStatusMessage(`Build completed.`)
            setStatistics(`output ${built.length} bytes in ${end - start}ms, fetched ${cachedSources.size} things, processed ${cachedProcessed.size} files`)
            const target = document.getElementById('target')!
            target.innerHTML = ''
            nodify(built).forEach(el => target.appendChild(el))
            const render = document.getElementById('render')!
            const parsed = Iota.fromHexIota(target.innerText)
            render.innerHTML = ''
            if (parsed) {
                parsed.generateNodes(render)
            } else {
                render.textContent = 'Failed to parse'
            }
        } catch (e) {
            setStatusMessage(`Build failed`)
            if (e instanceof Error) console.log(e.message)
        }
    }

    window.addEventListener('load', load)
})()