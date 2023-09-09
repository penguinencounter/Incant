import { Pattern, directions } from "./shared.js"
import { Tag } from "./nbt.js"

function byte(n: number): string {
    return `${n.toFixed(0)}b`
}
function long(n: number): string {
    return `${n.toFixed(0)}L`
}

const IOTA_TYPES: {[key: string]: (data: Tag) => {}} = {
    'hexcasting:pattern': (data: Tag) => PatternIota.fromNBT(data)
}

abstract class Iota {
    public abstract type: string
    public abstract data: any
    protected abstract innerAsNBT(): string
    public asNBT(): string {
        return `{"hexcasting:type":"${this.type}","hexcasting:data":${this.innerAsNBT()}}`
    }

    public abstract count(): number
    public static fromNBT(data: Tag): Iota {
        throw new Error('fromNBT is abstract in Iota - use a subclass')
    }
}

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
}

class NumberIota extends Iota {
    protected innerAsNBT(): string {
        return this.data.toString() // double is the default for NBT
    }
    constructor(public readonly data: number) {
        super()
    }
    readonly type: string = 'hexcasting:double'
    readonly count: () => number = () => 1
}

class BooleanIota extends Iota {
    protected innerAsNBT(): string {
        return this.data ? '1b' : '0b'
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
    constructor(public readonly data: [number, number, number]) {
        super()
    }
    readonly type: string = 'hexcasting:vec3'
    readonly count: () => number = () => 1
}

class NullIota extends Iota {
    protected innerAsNBT(): string {
        // hexcasting doesn't care about the value, just the type
        return '0b'
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
    constructor(public readonly data: Iota[]) {
        super()
    }
    readonly type: string = 'hexcasting:list'
    readonly count: () => number = () => (this.data.reduce((a, b) => a + b.count(), 0) + 1)
}

// MoreIotas
class StringIota extends Iota {
    protected innerAsNBT(): string {
        return `"${this.data}"`
    }
    constructor(public readonly data: string) {
        super()
    }
    readonly type: string = 'moreiotas:string'
    readonly count: () => number = () => 1
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