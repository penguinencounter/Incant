import { Iota, PatternIota } from "./iotas.js"

class Pattern {
    constructor(public direction: Direction, public pattern: string) { }
    public extend(path: string): Pattern {
        return new Pattern(this.direction, this.pattern + path)
    }
    public last(): string {
        return this.pattern[this.pattern.length - 1]
    }
    public toString(): string {
        return `<${this.direction.name},${this.pattern}>`
    }

    public toIota(): Iota {
        return new PatternIota(this)
    }
}

class IotaInject extends Pattern {
    constructor(public iota: string) {
        super(directions.E, '')
    }
    public extend(path: string): Pattern {
        throw new Error('Cannot extend IotaInject')
    }
    public toString(): string {
        return `${this.iota}`
    }
    public override toIota(): Iota {
        return Iota.fromHexIota(this.iota)!
    }
}

class StreamReader {
    private cursor: number = 0
    get cursorPos() {return this.cursor}
    constructor(public content: string) { }
    private failEOF() {
        if (this.isAtEOF()) throw new Error('Unexpected EOF')
    }
    public advance(): string {
        this.failEOF()
        return this.content[this.cursor++]
    }
    public peek(): string {
        if (this.isAtEOF()) return '\0'
        return this.content[this.cursor]
    }
    private peek2(n: number): string {
        if (this.cursor + n >= this.content.length) return '\0' 
        return this.content[this.cursor + n]
    }
    public peekAhead(n: number): string {
        let collection = ""
        for (let i = 0; i < n; i++) {
            collection += this.peek2(i)
        }
        return collection
    }
    public isAtEOF(): boolean {
        return this.cursor >= this.content.length
    }

    public customMultiRead(validator: (char: string) => boolean): string {
        let collection = ""
        while (!this.isAtEOF() && validator(this.peek())) collection += this.advance()
        return collection
    }

    public readUntil(text: string, advanceSep: boolean = true, includeSep: boolean = false) {
        let collection = ""
        if (advanceSep) {
            while (!this.isAtEOF() && this.peekAhead(text.length) !== text) collection += this.advance()
            // one-liners :D
            if (includeSep && !this.isAtEOF()) {
                collection += new Array(text.length).fill(0).map(_ => this.advance()).join('')
            }
            return collection
        } else {
            while (!this.isAtEOF() && this.peekAhead(text.length) !== text) collection += this.advance()
            if (includeSep) {
                collection += text // we don't advance past the separator
                // but this stupid, so dish out a warning
                console.warn('readUntil called with includeSep=true and advanceSep=false (very jank) Are you *sure* this is right?')
            }
            return collection
        }
    }

    public match(char: string): boolean {
        const next_ = this.peek()
        if (next_ === char) {
            this.advance()
            return true
        }
        return false
    }
    public matchs(k: string) {
        const origin = this.cursor
        for (const char of k.split('')) {
            if (!this.match(char)) {
                this.cursor = origin
                return false
            }
        }
        return true
    }

    public expect(chars: string) {
        for (const char of chars.split('')) {
            if (!this.match(char)) throw new Error(`Expected ${char} at ${this.cursor} but got ${this.peek()} (before: ${this.content.slice(this.cursor - 10, this.cursor)} | ${this.content.slice(this.cursor, this.cursor + 10)} :after)`)
        }
    }

    public rewind() {
        if (this.cursor === 0) throw new Error('Cannot rewind past start of stream')
        this.cursor = Math.max(0, this.cursor - 1)
    }

    public skipWhitespace() {
        while (!this.isAtEOF() && this.peek().match(/\s/)) this.advance()
    }

    public branch(): StreamReader {
        return new StreamReader(this.content.slice(this.cursor))
    }
}

class Direction {
    constructor(public name: string) { }
    public apply(pattern: string) {
        return new Pattern(this, pattern)
    }
}
const
    SE = new Direction('se'),
    SW = new Direction('sw'),
    W = new Direction('w'),
    NW = new Direction('nw'),
    NE = new Direction('ne'),
    E = new Direction('e'),
    directions = { SE, SW, W, NW, NE, E, SOUTH_EAST: SE, SOUTH_WEST: SW, WEST: W, NORTH_WEST: NW, NORTH_EAST: NE, EAST: E, NORTHEAST: NE, NORTHWEST: NW, SOUTHEAST: SE, SOUTHWEST: SW }

function stripString(s: string): string {
    return s.replace(/^\s*(.*?)\s*$/, '$1')
}

function nodify(multiline: string): HTMLDivElement[] {
    const els = []
    for (const line of multiline.split('\n')) {
        const el = document.createElement('div')
        el.textContent = line
        els.push(el)
    }
    return els
}
export {
    Pattern,
    IotaInject,
    Direction,
    StreamReader,
    directions,
    stripString,
    nodify
}