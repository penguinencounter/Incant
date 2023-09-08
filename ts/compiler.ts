import { Pattern, Direction, directions, stripString } from './shared.js'

type ArrayType<T> = T extends Array<infer U> ? U : never

type CSVFile<Scheme extends string[]> = {
    headers: Scheme,
    rows: {
        [header in ArrayType<Scheme>]: string | null
    }[]
}
type CSVRow<T extends CSVFile<any>> = T['rows'][number]

type SpellDatabaseSchema = ["mod", "translation", "direction", "pattern", "is_great", "modid", "name", "classname", "args", "book_anchor"]
const SpellDatabaseSchema: SpellDatabaseSchema = ["mod", "translation", "direction", "pattern", "is_great", "modid", "name", "classname", "args", "book_anchor"]

const yield_ = () => new Promise((resolve, reject) => setTimeout(resolve, 0))

const doesPathOverlap = (path: string): boolean => {
    // q is up-right diagonal
    // r is vertical line
    type AxialPoint = [number, number]  // q, r
    const cursor: AxialPoint = [0, 0]
    let facing = 0
    const facingDir = ['e', 'se', 'sw', 'w', 'nw', 'ne']
    const segments: Set<string> = new Set()
    const literal: string[] = ['e']
    for (const direction of path.split('')) {
        switch (direction) {
            case 'a':
                facing -= 2
                break
            case 'q':
                facing -= 1
                break
            case 'w':
                facing += 0
                break
            case 'e':
                facing += 1
                break
            case 'd':
                facing += 2
                break
            case 's':
                facing += 3
                break
        }
        facing = ((facing % 6) + 6) % 6
        literal.push(facingDir[facing])
    }
    for (const direction of literal) {
        const last = cursor.slice() as AxialPoint
        const [q_, r_] = last
        switch (direction) {
            case 'e':
                cursor[0] += 1
                break
            case 'w':
                cursor[0] -= 1
                break
            case 'se':
                cursor[1] += 1
                break
            case 'nw':
                cursor[1] -= 1
                break
            case 'ne':
                cursor[0] += 1
                cursor[1] -= 1
                break
            case 'sw':
                cursor[0] -= 1
                cursor[1] += 1
                break
        }
        const [q, r] = cursor
        const nx = `${q},${r},${q_},${r_}`
        const nx2 = `${q_},${r_},${q},${r}`
        if (
            segments.has(nx) || segments.has(nx2)
        ) {
            // console.log("failed moving to", cursor, "from", last, "with", direction, "in", literal)
            // console.log("previous segments", segments)
            return true
        }
        segments.add(nx)
    }
    return false
}

const Modes = {
    FAST: 100,
    FASTER: 10,
    UNWEIGHTED: 0,
    SHORTER: 10000
}

const NumberCache: { [val: number]: string } = {}

const STEP_WEIGHT = Modes.SHORTER
const numberHelper = async (target: number): Promise<string> => {
    if (NumberCache[target]) return NumberCache[target]
    const start = Date.now()

    // current heuristic: <no-of-steps plus 1> * <abs distance from target>
    function cost(step: number, x: number) {
        let bonus = 0
        if (x > target) bonus += 1000
        // return step // SHORTEST
        return (step * STEP_WEIGHT) + Math.abs(x - target) + bonus
    }
    let frontier: [number, number, number, string][] = [
        [cost(1, 0), 1, 0, ""]
    ]
    let steps = 0
    let visited: number[] = []
    function getNexts(from: [number, number, number, string]) {
        const [_, step, current, path] = from
        let possibilites: [number, number, number, string][] = []
        if (current < target) {
            possibilites = possibilites.concat([
                [cost(step + 1, current + 5), step + 1, current + 5, path + "q"], // slight left
                [cost(step + 1, current + 1), step + 1, current + 1, path + "w"], // forward
                [cost(step + 1, current + 10), step + 1, current + 10, path + "e"], // slight right
            ])
        }
        if (step > 1) {
            if (current < target) {
                possibilites.push(
                    [cost(step + 1, current * 2), step + 1, current * 2, path + "a"], // sharp left
                )
            } else {
                possibilites.push(
                    [cost(step + 1, current / 2), step + 1, current / 2, path + "d"], // sharp right
                )
            }
        }
        return possibilites.filter(([_, __, score, path_]) => !doesPathOverlap("aqaa" + path_))
    }

    while (frontier.length > 0) {
        steps++
        // sort by cost, ascending
        frontier.sort((a, b) => a[0] - b[0])
        if (steps % 100 === 0) {
            const end = Date.now()
            console.log(`${steps} steps, ${end - start}ms, ${frontier.length} frontier nodes, best is ${frontier[0][0]} (step ${frontier[0][1]}, ${frontier[0][2]})`)
            await yield_()
        }
        const next = frontier.shift()!
        if (next[2] === target) {
            const end = Date.now()
            if (end - start > 100)
                console.log(`solution found in ${steps} steps, took ${end - start}ms`)
            NumberCache[target] = next[3]
            return next[3]
        }
        if (visited.includes(next[2])) continue
        visited.push(next[2])
        frontier = frontier.concat(getNexts(next))
    }
    console.error("failed to find a path after " + steps + " steps")
    console.log()
    throw new Error("Could not find a path")
}

class SpellDatabase {
    sources: CSVFile<SpellDatabaseSchema>
    constructor(sources: CSVFile<SpellDatabaseSchema>) {
        this.sources = sources
    }

    public queryByName(name: string): CSVRow<CSVFile<SpellDatabaseSchema>> | null {
        const row = this.sources.rows.find(row => row.translation === name)
        if (!row) return null
        return row
    }

    public async generateNumber(theNumber: number) {
        const plus = directions.SE.apply("aqaa")
        const minus = directions.NE.apply("dedd")
        if (theNumber >= 0) return plus.extend(await numberHelper(theNumber))
        else return minus.extend(await numberHelper(-theNumber))
    }
    public generateBookkeeper(mask: string) {
        if (mask.length < 1) throw new Error(`Invalid mask: "${mask}"`)
        const starter = mask[0]
        let build: Pattern
        if (starter == 'v') {
            build = directions.SE.apply("a")
        } else if (starter == '-') {
            build = directions.E.apply("")
        } else {
            throw new Error(`Invalid character in mask: "${starter}"`)
        }
        mask = mask.slice(1)
        for (const char of mask) {
            if (!['v', '-'].includes(char)) throw new Error(`Invalid character in mask: "${char}"`)
            if (char == 'v') {
                if (build.last() == 'a') build = build.extend("da")
                else build = build.extend("ea")
            } else {
                if (build.last() == 'a') build = build.extend("e")
                else build = build.extend("w")
            }
        }
        return build
    }
}

function parseCSV<Schema extends string[]>(content: string, scheme: Schema): CSVFile<Schema> {
    const lines = content.split('\n')
    const headers = lines[0].split(',')
    if (headers.length !== scheme.length) throw new Error('Scheme does not match CSV')
    if (headers.some((header, index) => header !== scheme[index])) throw new Error('Scheme does not match CSV')
    const headers_ = headers as Schema
    const rows = lines.slice(1).map(line => line.split(','))
    return {
        headers: headers_,
        rows: rows.map(row => {
            const obj: Partial<{ [key in ArrayType<Schema>]: string | null }> = {}
            for (let key of headers_) {
                obj[key as keyof typeof obj] = null
            }
            const obj2 = obj as { [key in ArrayType<Schema>]: string | null }
            for (let i = 0; i < row.length; i++) {
                obj2[headers[i] as keyof typeof obj2] = row[i]
            }
            return obj2
        })
    }
}

const TABLE_SRC = 'https://object-object.github.io/HexBug/patterns.csv'
async function getSpellMeta() {
    const resp = await fetch(TABLE_SRC)
    const text = await resp.text()
    const data = parseCSV(text, SpellDatabaseSchema)
    return data
}

async function iotafy(db: SpellDatabase, pattern: string) {
    pattern = stripString(pattern)
    const strippedOriginal = pattern
    if (pattern === '') return null
    pattern = pattern.replaceAll('{', 'Introspection').replaceAll('}', 'Retrospection')
    let result: Pattern | null = null
    const numericalReflection = /^Numerical Reflection: (.+)$/
    if (numericalReflection.test(pattern)) {
        const value = parseFloat(pattern.match(numericalReflection)![1])
        // if (value > 1000 && !NumberCache[value]) statusMessageAcceptor(`Solving number: ${value}`)
        result = await db.generateNumber(value)
    }
    const bookkeepers = /^Bookkeeper's Gambit: ([\-v]+)$/
    if (bookkeepers.test(pattern)) {
        const mask = pattern.match(bookkeepers)![1]
        result = db.generateBookkeeper(mask)
    }
    if (!result) {
        const possible = db.queryByName(pattern)
        if (!possible) {
            console.log("failed to translate", pattern)
            return null
        } else {
            result = directions[possible.direction as keyof typeof directions].apply(possible.pattern!)
        }
    }
    return result
}

async function translatePattern(db: SpellDatabase, pattern: string) {
    const result = await iotafy(db, pattern)
    if (!result) return ''
    return `${result.direction.name},${result.pattern}`
}

export default async function() {
    // init stuffs
    const db = new SpellDatabase(await getSpellMeta())
    return {
        db,
        iotafy: iotafy.bind(null, db),
        translatePattern: translatePattern.bind(null, db)
    }
}