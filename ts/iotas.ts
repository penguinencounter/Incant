import { Pattern, StreamReader, directions } from "./shared.js"
import { Tag } from "./nbt.js"

function byte(n: number): string {
    return `${n.toFixed(0)}b`
}
function long(n: number): string {
    return `${n.toFixed(0)}L`
}

const IOTA_TYPES: { [key: string]: (data: Tag) => {} } = {
    'hexcasting:pattern': (data: Tag) => PatternIota.fromNBT(data)
}

abstract class Iota {
    public abstract type: string
    public abstract data: any
    protected abstract innerAsNBT(): string
    public asNBT(): string {
        return `{"hexcasting:type":"${this.type}","hexcasting:data":${this.innerAsNBT()}}`
    }

    public abstract generateNodes(container: HTMLElement): void

    public abstract count(): number
    public static fromNBT(data: Tag): Iota {
        throw new Error('fromNBT is abstract in Iota - use a subclass')
    }
    protected static fromHexIota_(data: StreamReader): Iota | null {
        data.skipWhitespace()
        if (data.isAtEOF()) return null // The empty tag
        const KEYWORDS = {
            'true': () => new BooleanIota(true),
            'false': () => new BooleanIota(false),
            'True': () => new BooleanIota(true),
            'False': () => new BooleanIota(false),
            'null': () => new NullIota(),
            'Null': () => new NullIota(),
            'NULL': () => new NullIota()
        } as const
        const keyer = data.advance()
        switch (true) {
            case (/[0123456789\.\-]/.test(keyer)):
                data.rewind()
                return NumberIota.fromHexIota_(data)
            case (keyer === '"'):
                data.rewind()
                return StringIota.fromHexIota_(data)
            case (keyer === '('):
                data.rewind()
                return VectorIota.fromHexIota_(data)
            case (keyer === '['):
                data.rewind()
                return ListIota.fromHexIota_(data)
            case (keyer === '<'):
                data.rewind()
                return PatternIota.fromHexIota_(data)
            default:
                data.rewind()
                for (const [k, v] of Object.entries(KEYWORDS)) {
                    if (data.matchs(k)) return v()
                }
                console.log(`Don't know what to do at position ${data.cursorPos} (${data.peekAhead(10)} / ident by ${keyer}). Check your syntax?`)
                return null
        }
    }
    public static fromHexIota(data: string): Iota | null {
        return this.fromHexIota_(new StreamReader(data))
    }
}

declare global {
    interface Window {
        Iota: typeof Iota
    }
}

window.Iota = Iota

class PatternIota extends Iota {
    public static readonly START_ANGLES = {
        ne: 0,
        e: 1,
        se: 2,
        sw: 3,
        w: 4,
        nw: 5
    }
    public static readonly ANGLES = {
        a: 4,
        q: 5,
        w: 0,
        e: 1,
        d: 2,
        s: 3
    }
    constructor(public readonly data: Pattern) {
        super()
    }
    protected innerAsNBT(): string {
        const startAngle = PatternIota.START_ANGLES[this.data.direction.name as keyof typeof PatternIota.START_ANGLES]
        const angles = this.data.pattern.split('').map(c => byte(PatternIota.ANGLES[c as keyof typeof PatternIota.ANGLES]))
        return `{startDir:${byte(startAngle)},angles:[B;${angles.join(',')}]}`
    }
    readonly type: string = 'hexcasting:pattern'
    readonly count: () => number = () => 1

    public static fromNBT(data: Tag): PatternIota {
        return new PatternIota(new Pattern(directions.E, ''))
    }

    public generateNodes(container: HTMLElement): void {
        const pattern = document.createElement('div')
        pattern.classList.add("iota", "_pattern")
        const type_span = document.createElement('span')
        type_span.classList.add('_type')
        type_span.innerHTML = 'Pattern'
        pattern.appendChild(type_span)
        const content_span = document.createElement('span')
        content_span.classList.add('_content')
        content_span.innerHTML = this.data.direction.name + ' ' + this.data.pattern
        pattern.appendChild(content_span)
        container.appendChild(pattern)
    }

    static override fromHexIota_(data: StreamReader): PatternIota | null {
        data.expect('<')
        data.skipWhitespace()
        let direction = data.readUntil(',', false, false).trim()
        if (!Object.keys(directions).includes(direction.toUpperCase())) {
            throw new Error(`Expected a valid direction at ${data.cursorPos} but got ${direction}.\nValid directions are ${Object.keys(directions)}`)
        }
        data.skipWhitespace()
        data.expect(',')
        data.skipWhitespace()
        const pattern = data.customMultiRead(c => /[qweasdQWEASD]/.test(c)).toLowerCase()
        data.skipWhitespace()
        data.expect('>')
        return new PatternIota(new Pattern(directions[direction.toUpperCase() as keyof typeof directions], pattern.toLowerCase()))
    }
}

class NumberIota extends Iota {
    protected innerAsNBT(): string {
        return this.data.toString() // double is the default for NBT
    }

    public generateNodes(container: HTMLElement): void {
        const block = document.createElement('div')
        block.classList.add("iota", "_number")
        const type_span = document.createElement('span')
        type_span.classList.add('_type')
        type_span.innerHTML = 'Number'
        block.appendChild(type_span)
        const content_span = document.createElement('span')
        content_span.classList.add('_content')
        content_span.innerHTML = this.data.toString()
        block.appendChild(content_span)
        container.appendChild(block)
    }
    constructor(public readonly data: number) {
        super()
    }
    static override fromHexIota_(stream: StreamReader): NumberIota | null {
        let collection = ''
        let isValid = false
        if (stream.peek() === '-') collection += stream.advance()
        while (!stream.isAtEOF() && stream.peek().match(/[0-9]/)) {
            collection += stream.advance()
            isValid = true
        }
        if (stream.peek() === '.') {
            stream.advance()
            collection += '.'
            while (!stream.isAtEOF() && stream.peek().match(/[0-9]/)) {
                collection += stream.advance()
                isValid = true
            }
        }
        if (isValid && collection.length > 0) return new NumberIota(parseFloat(collection))
        return null // single hyphens, dots, and empty strings are not valid numbers
    }
    readonly type: string = 'hexcasting:double'
    readonly count: () => number = () => 1
}

class BooleanIota extends Iota {
    protected innerAsNBT(): string {
        return this.data ? '1b' : '0b'
    }
    public generateNodes(container: HTMLElement): void {
        const block = document.createElement('div')
        block.classList.add("iota")
        if (this.data) block.classList.add("_true")
        else block.classList.add("_false")
        const value = document.createElement('span')
        value.classList.add('_content')
        value.innerHTML = this.data ? 'True' : 'False'
        block.appendChild(value)
        container.appendChild(block)
    }
    constructor(public readonly data: boolean) {
        super()
    }
    readonly type: string = 'hexcasting:boolean'
    readonly count: () => number = () => 1
}

class VectorIota extends Iota {
    protected innerAsNBT(): string {
        if (this.data.every(e => e % 1 === 0)) {
            return `[L;${this.data.map(e => long(e)).join(',')}]`
        }
        return `{x:${this.data[0]},y:${this.data[1]},z:${this.data[2]}}`
    }
    public generateNodes(container: HTMLElement): void {
        const block = document.createElement('div')
        block.classList.add("iota", "_vector")
        const type_span = document.createElement('span')
        type_span.classList.add('_type')
        type_span.innerHTML = 'Vector'
        block.appendChild(type_span)
        const content_span = document.createElement('span')
        content_span.classList.add('_content')
        content_span.innerHTML = `${this.data[0]}, ${this.data[1]}, ${this.data[2]}`
        block.appendChild(content_span)
        container.appendChild(block)
    }
    constructor(public readonly data: [number, number, number]) {
        super()
    }
    readonly type: string = 'hexcasting:vec3'
    readonly count: () => number = () => 1

    static fromHexIota_(data: StreamReader): VectorIota | null {
        data.expect('(')
        data.skipWhitespace()
        const x = NumberIota.fromHexIota_(data)
        if (!x) return null
        data.skipWhitespace()
        data.expect(',')
        data.skipWhitespace()
        const y = NumberIota.fromHexIota_(data)
        if (!y) return null
        data.skipWhitespace()
        data.expect(',')
        data.skipWhitespace()
        const z = NumberIota.fromHexIota_(data)
        if (!z) return null
        data.skipWhitespace()
        data.expect(')')
        return new VectorIota([x.data, y.data, z.data])
    }
}

class NullIota extends Iota {
    protected innerAsNBT(): string {
        // hexcasting doesn't care about the value, just the type
        return '0b'
    }
    public generateNodes(container: HTMLElement): void {
        const block = document.createElement('div')
        block.classList.add("iota", "_null")
        const value = document.createElement('span')
        value.classList.add('_content')
        value.innerHTML = 'Null'
        block.appendChild(value)
        container.appendChild(block)
    }
    constructor() {
        super()
    }
    readonly data: null = null
    readonly type: string = 'hexcasting:null'
    readonly count: () => number = () => 1
}

class ListIota extends Iota {
    protected innerAsNBT(): string {
        return `[${this.data.map(e => e.asNBT()).join(',')}]`
    }
    public generateNodes(container: HTMLElement): void {
        const block = document.createElement('div')
        block.classList.add("iota", "_list")
        const type_span = document.createElement('span')
        type_span.classList.add('_type')
        type_span.innerHTML = 'List'
        block.appendChild(type_span)
        const content_span = document.createElement('span')
        content_span.classList.add('_content')
        if (this.data.length === 0) {
            content_span.innerHTML = 'empty'
        } else {
            content_span.innerHTML = `${this.data.length} items`
            block.classList.add('_full')
            // container.classList.remove('_compact')
        }
        block.appendChild(content_span)
        const weight_span = document.createElement('span')
        weight_span.classList.add('_weight')
        weight_span.innerHTML = `${this.count()}`
        block.appendChild(weight_span)
        container.appendChild(block)
        if (this.data.length === 0) {
            return
        }
        const indentContainer = document.createElement('div')
        indentContainer.classList.add('list-indent', '_compact')
        container.appendChild(indentContainer)
        for (const iota of this.data) {
            iota.generateNodes(indentContainer)
        }
    }
    constructor(public readonly data: Iota[]) {
        super()
    }
    readonly type: string = 'hexcasting:list'
    readonly count: () => number = () => (this.data.reduce((a, b) => a + b.count(), 0) + 1)

    static fromHexIota_(data: StreamReader): ListIota | null {
        data.expect('[')
        data.skipWhitespace()
        if (data.match(']')) return new ListIota([])
        let list = []
        let continue_ = true
        while (continue_) {
            data.skipWhitespace()
            let result = Iota.fromHexIota_(data)
            // Invalid the entire iota if one of the children was invalid
            if (!result) return null
            list.push(result)
            data.skipWhitespace()
            data.match(',')
            data.skipWhitespace()
            continue_ = data.peek() != ']'
        }
        data.skipWhitespace()
        data.expect(']')
        return new ListIota(list)
    }
}

// MoreIotas
class StringIota extends Iota {
    protected innerAsNBT(): string {
        return `"${this.data}"`
    }
    public generateNodes(container: HTMLElement): void {
        const block = document.createElement('div')
        block.classList.add("iota", "_string")
        const type_span = document.createElement('span')
        type_span.classList.add('_type')
        type_span.innerHTML = 'String'
        block.appendChild(type_span)
        const content_span = document.createElement('span')
        content_span.classList.add('_content')
        content_span.innerHTML = `"${this.data}"`
        block.appendChild(content_span)
        container.appendChild(block)
    }
    constructor(public readonly data: string) {
        super()
    }
    readonly type: string = 'moreiotas:string'
    readonly count: () => number = () => 1

    static fromHexIota_(data: StreamReader): StringIota | null {
        data.expect('"')
        let collection = ""
        let escaped = false
        while (!data.isAtEOF()) {
            const next = data.advance()
            if (escaped) {
                collection += next
                escaped = false
            } else if (next === "\\") {
                escaped = true
            } else if (next === '"') {
                break
            } else {
                collection += next
            }
        }
        return new StringIota(collection)
    }
}

export {
    Iota,
    PatternIota,
    NumberIota,
    BooleanIota,
    VectorIota,
    NullIota,
    ListIota,
    StringIota
}