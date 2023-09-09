import { StreamReader, stripString } from "./shared"

abstract class Tag {
    public abstract value: any
    public abstract toString(): string

    public wrapList(): ListTag<typeof this> {
        return new ListTag([this])
    }
    public wrapCompound(key: string): CompoundTag {
        return new CompoundTag(new Map([[key, this]]))
    }

    public static fromStream(stream: StreamReader): Tag {
        stream.skipWhitespace() // why not lol
        const next = stream.peek()
        switch (next) {
            case '{':
                return CompoundTag.fromStream(stream)
            case '[':
                return ListLikeTag.fromStream(stream) // we don't know which it is
            case '"':
                return StringTag.fromStream(stream) // no, we can't do it here, there's escaping logic
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
            case '-':
            case '.':
                return NumberTag.fromStream(stream)
        }
        console.warn("bad style: could not determine type of tag, so trying StringTag at cursor " + stream.peekAhead(10))
        return StringTag.fromStream(stream)
    }
}

abstract class NumberTag extends Tag {
    public abstract value: number
    protected readonly supportsFloat: boolean = false
    protected abstract readonly suffix: string
    public toString(): string {
        if (this.supportsFloat) {
            return `${this.value}${this.suffix}`
        }
        return `${this.value.toFixed(0)}${this.suffix}`
    }

    public static fromStream(stream: StreamReader): NumberTag {
        let whole = "", decimal = "", exponent = ""
        if (stream.peek() === '-') {
            whole += stream.advance()
        }
        while (!stream.isAtEOF()) {
            const next = stream.peek()
            if (next.match(/[0-9]/)) {
                whole += next
                stream.advance()
            } else {
                break
            }
        }
        if (stream.peek() === '.') {
            stream.advance()
            while (!stream.isAtEOF()) {
                const next = stream.peek()
                if (next.match(/[0-9]/)) {
                    decimal += next
                    stream.advance()
                } else {
                    break
                }
            }
        }
        if (stream.peek() === 'e' || stream.peek() === 'E') {
            stream.advance()
            while (!stream.isAtEOF()) {
                const next = stream.peek()
                if (next.match(/[0-9]/)) {
                    exponent += next
                    stream.advance()
                } else {
                    break
                }
            }
        }
        const pexp = Math.pow(10, exponent.length > 0 ? parseInt(exponent) : 0)
        const wholeValue = parseInt(whole) * pexp
        const decimalValue = parseFloat(whole + '.' + decimal) * pexp
        const disallowFloat = () => { if (decimal.length !== 0) throw new Error("That data type doesn't support floating point values") }
        switch (stream.peek()) {
            case 'b':
            case 'B':
                disallowFloat()
                stream.advance()
                return new ByteTag(wholeValue)
            case 's':
            case 'S':
                disallowFloat()
                stream.advance()
                return new ShortTag(wholeValue)
            case 'l':
            case 'L':
                disallowFloat()
                stream.advance()
                return new LongTag(wholeValue)
            case 'f':
            case 'F':
                stream.advance()
                return new FloatTag(decimalValue)
            case 'd':
            case 'D':
                stream.advance()
                return new DoubleTag(decimalValue)
            default:
                if (decimal.length !== 0 || exponent.length !== 0) {  // Exponents my beloved
                    return new DoubleTag(decimalValue)
                }
                disallowFloat()
                return new IntTag(wholeValue)
        }
    }
}

class ByteTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'b'
    public static fromStream(_: StreamReader): never { throw new Error("Use NumberTag.fromStream() instead") }
}
const NBTTrue = () => new ByteTag(1)
const NBTFalse = () => new ByteTag(0)
class ShortTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 's'
    public static fromStream(_: StreamReader): never { throw new Error("Use NumberTag.fromStream() instead") }

}
class IntTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = ''
    public static fromStream(_: StreamReader): never { throw new Error("Use NumberTag.fromStream() instead") }

}
class LongTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'L'
    public static fromStream(_: StreamReader): never { throw new Error("Use NumberTag.fromStream() instead") }

}
class FloatTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'f'
    protected override readonly supportsFloat: boolean = true
    public static fromStream(_: StreamReader): never { throw new Error("Use NumberTag.fromStream() instead") }
}
class DoubleTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'd'
    protected override readonly supportsFloat: boolean = true
    public static fromStream(_: StreamReader): never { throw new Error("Use NumberTag.fromStream() instead") }
}

class StringTag extends Tag {
    constructor(public value: string) {
        super()
    }
    public toString(): string {
        // escape quotes and backslashes
        let escaped = this.value.replace(/\\/g, '\\\\')
        escaped = escaped.replace(/"/g, '\\"')
        return `"${escaped}"`
    }

    public static fromStream(stream: StreamReader) {
        // no, it *doesn't* have to start with a "
        const canDoEscaping = stream.match('"') // but if it does well then
        let collection = ""
        let escaped = false
        while (!stream.isAtEOF()) {
            const next = stream.advance()
            if (canDoEscaping) {
                if (escaped) {
                    collection += next
                    escaped = false
                } else if (next === '\\') {
                    escaped = true
                } else if (next === '"') {
                    break
                } else {
                    collection += next
                }
            } else {
                if (/^[a-zA-Z0-9_\-\.\+]$/.test(next)) {
                    collection += next
                } else {
                    stream.rewind() // don't eat the next char
                    break // end of string, encountered a non-allowed character
                }
            }
        }
        return new StringTag(collection)
    }
}

abstract class ListLikeTag<TypeFilter extends Tag> extends Tag {
    public abstract value: TypeFilter[]
    protected abstract readonly prefix: string
    public toString(): string {
        return `[${this.prefix}${this.value.map(e => e.toString()).join(',')}]`
    }

    public static fromStream(stream: StreamReader): ListLikeTag<Tag> {
        const parallel = stream.branch()  // backup stream, each implementation can expect('[') and we don't want to eat the '['
        parallel.expect('[')
        // *no spaces allowed. yes I tested this
        const possibleNextPrefix = parallel.peekAhead(2)
        switch (possibleNextPrefix) {
            case 'B;':
                return ByteArrayTag.fromStream(stream)
            case 'I;':
                return IntArrayTag.fromStream(stream)
            case 'L;':
                return LongArrayTag.fromStream(stream)
            default:
                return ListTag.fromStream(stream)
        }
    }

    public recursiveRewrite(predicate: (key: string, value: Tag) => boolean, action: (value: Tag) => Tag) {
        for (const [index, value] of this.value.entries()) {
            if (predicate(index.toString(), value)) {
                this.value[index] = action(value) as TypeFilter
            } else {
                if (value instanceof CompoundTag) {
                    value.recursiveRewrite(predicate, action)
                }
                if (value instanceof ListLikeTag) {
                    value.recursiveRewrite(predicate, action)
                }
            }
        }
        if (this instanceof ListTag) this.infer()
    }
}
class ListTag<T extends Tag> extends ListLikeTag<T> {
    protected readonly prefix: string = ''
    private inferredType: string | null = null
    constructor(public value: T[]) {
        super()
        this.infer()
    }
    public infer() {
        if (this.value.length === 0) return
        this.inferredType = this.value[0].constructor.name
        for (const element of this.value) {
            if (element.constructor.name !== this.inferredType) {
                throw new Error(`ListTag cannot contain mixed types: earlier elements are ${this.inferredType}, tried to add ${element.constructor.name}\nContents: ${this.toString()}`)
            }
        }
    }

    public add(value: T) {
        if (this.inferredType !== null && this.inferredType !== value.constructor.name) {
            throw new Error(`ListTag cannot contain mixed types: already ${this.inferredType}[], tried to insert ${value.constructor.name}\nContents: ${this.toString()}`)
        }
        this.value.push(value)
        this.infer()
    }

    public static fromStream(stream: StreamReader): ListTag<Tag> {
        stream.expect('[')
        stream.skipWhitespace()
        if (stream.match(']')) return new ListTag<Tag>([])
        let list: Tag[] = []
        let continue_ = true
        while (continue_) {
            stream.skipWhitespace()
            let theTag = Tag.fromStream(stream)
            list.push(theTag)
            stream.skipWhitespace()
            continue_ = stream.match(',')
        }
        stream.skipWhitespace()
        stream.expect(']')
        return new ListTag(list)
    }
}
class ByteArrayTag extends ListLikeTag<ByteTag> {
    protected readonly prefix: string = 'B;'
    constructor(public value: ByteTag[]) {
        super()
    }

    public static fromStream(stream: StreamReader): ByteArrayTag {
        stream.expect('[B;')
        stream.skipWhitespace()
        if (stream.match(']')) return new ByteArrayTag([])
        let list = []
        let continue_ = true
        while (continue_) {
            stream.skipWhitespace()
            list.push(new ByteTag(NumberTag.fromStream(stream).value))
            stream.skipWhitespace()
            continue_ = stream.match(',')
        }
        stream.skipWhitespace()
        stream.expect(']')
        return new ByteArrayTag(list)
    }
}
class IntArrayTag extends ListLikeTag<IntTag> {
    protected readonly prefix: string = 'I;'
    constructor(public value: IntTag[]) {
        super()
    }

    public static fromStream(stream: StreamReader): IntArrayTag {
        stream.expect('[I;')
        stream.skipWhitespace()
        if (stream.match(']')) return new IntArrayTag([])
        let list = []
        let continue_ = true
        while (continue_) {
            stream.skipWhitespace()
            list.push(new IntTag(NumberTag.fromStream(stream).value))
            stream.skipWhitespace()
            continue_ = stream.match(',')
        }
        stream.skipWhitespace()
        stream.expect(']')
        return new IntArrayTag(list)
    }
}
class LongArrayTag extends ListLikeTag<LongTag> {
    protected readonly prefix: string = 'L;'
    constructor(public value: LongTag[]) {
        super()
    }

    public static fromStream(stream: StreamReader): LongArrayTag {
        stream.expect('[L;')
        stream.skipWhitespace()
        if (stream.match(']')) return new LongArrayTag([])
        let list = []
        let continue_ = true
        while (continue_) {
            stream.skipWhitespace()
            list.push(new LongTag(NumberTag.fromStream(stream).value))
            stream.skipWhitespace()
            continue_ = stream.match(',')
        }
        stream.skipWhitespace()
        stream.expect(']')
        return new LongArrayTag(list)
    }
}

class CompoundTag extends Tag {
    constructor(public value: Map<string, Tag>) {
        super()
    }
    public toString(): string {
        const entries = [...this.value.entries()]
        const stringificated = []
        for (const [key, value] of entries) {
            if (key === "") throw new Error("Empty key in compound tag")
            if (/^[a-zA-Z0-9_\-.]*$/.test(key)) { // can be unquoted
                stringificated.push(`${key}:${value.toString()}`)
            } else {
                // looks like we need to quote it!
                // escape quotes and backslashes
                let escaped = key.replace(/\\/g, '\\\\')
                escaped = escaped.replace(/"/g, '\\"')
                stringificated.push(`"${escaped}":${value.toString()}`)
            }
        }
        const body = stringificated.join(',')
        return `{${body}}`
    }

    public static fromStream(stream: StreamReader) {
        stream.expect('{')
        stream.skipWhitespace()
        if (stream.match('}')) return new CompoundTag(new Map())
        let mapsh = new Map()
        let continue_ = true
        while (continue_) {
            stream.skipWhitespace()
            const key = StringTag.fromStream(stream).value // piggyback on StringTag's escaping logic
            // eat the colon
            stream.expect(':')
            const value = Tag.fromStream(stream)
            mapsh.set(key, value)
            stream.skipWhitespace()
            continue_ = stream.match(',')
        }
        stream.skipWhitespace()
        stream.expect('}')
        return new CompoundTag(mapsh)
    }

    public recursiveRewrite(predicate: (key: string, value: Tag) => boolean, mapper: (tag: Tag) => Tag) {
        for (const [key, value] of this.value.entries()) {
            if (predicate(key, value)) {
                this.value.set(key, mapper(value))
            } else {
                if (value instanceof CompoundTag) {
                    value.recursiveRewrite(predicate, mapper)
                }
                if (value instanceof ListLikeTag) {
                    value.recursiveRewrite(predicate, mapper)
                }
            }
        }
    }
}

export {
    Tag,
    NumberTag,
    ByteTag,
    ShortTag,
    IntTag,
    LongTag,
    FloatTag,
    DoubleTag,
    StringTag,
    ListLikeTag,
    ListTag,
    ByteArrayTag,
    IntArrayTag,
    LongArrayTag,
    CompoundTag,
    NBTTrue,
    NBTFalse,
}