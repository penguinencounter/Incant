abstract class Tag {
    public abstract value: any
    public abstract toString(): string
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
}

class ByteTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'b'
}
const NBTTrue = () => new ByteTag(1)
const NBTFalse = () => new ByteTag(0)
class ShortTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 's'

}
class IntTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = ''

}
class LongTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'L'

}
class FloatTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'f'
    protected override readonly supportsFloat: boolean = true
}
class DoubleTag extends NumberTag {
    constructor(public value: number) {
        super()
    }
    protected suffix: string = 'd'
    protected override readonly supportsFloat: boolean = true
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

}

abstract class ListLikeTag<TypeFilter extends Tag> extends Tag {
    public abstract value: TypeFilter[]
    protected abstract readonly prefix: string
    public toString(): string {
        return `[${this.prefix}${this.value.map(e => e.toString()).join(',')}]`
    }
}
class ListTag extends ListLikeTag<Tag> {
    protected readonly prefix: string = ''
    constructor(public value: Tag[]) {
        super()
    }
}
class ByteArrayTag extends ListLikeTag<ByteTag> {
    protected readonly prefix: string = 'B;'
    constructor(public value: ByteTag[]) {
        super()
    }
}
class IntArrayTag extends ListLikeTag<IntTag> {
    protected readonly prefix: string = 'I;'
    constructor(public value: IntTag[]) {
        super()
    }
}
class LongArrayTag extends ListLikeTag<LongTag> {
    protected readonly prefix: string = 'L;'
    constructor(public value: LongTag[]) {
        super()
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
}

export {
    Tag
}