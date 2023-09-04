import { Pattern } from "./shared.js"

interface Iota {
    type: string
    value: any
}

interface PatternIota extends Iota {
    type: 'pattern'
    value: Pattern
}

interface NumberIota extends Iota {
    type: 'number'
    value: number
}

interface TrueIota extends Iota {
    type: 'true'
    value: true
}

interface FalseIota extends Iota {
    type: 'false'
    value: false
}

interface VectorIota extends Iota {
    type: 'vector'
    value: [ number, number, number ]
}

interface NullIota extends Iota {
    type: 'null'
    value: null
}

interface ListIota extends Iota {
    type: 'list'
    value: Iota[]
}

export type {
    Iota,
    PatternIota,
    NumberIota,
    TrueIota,
    FalseIota,
    VectorIota,
    NullIota,
    ListIota
}