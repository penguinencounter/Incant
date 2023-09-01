type ValOf<T> = T[keyof T]
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

class Pattern {
    constructor(public direction: Direction, public pattern: string) { }
    public extend(path: string): Pattern {
        return new Pattern(this.direction, this.pattern + path)
    }
}

class Direction {
    constructor(public name: string) { }
    public apply(path: string): Pattern {
        return new Pattern(
            this, path
        )
    }
}

// directions
const EAST = new Direction("e")
const WEST = new Direction("w")
const NORTHEAST = new Direction("ne")
const NORTHWEST = new Direction("nw")
const SOUTHEAST = new Direction("se")
const SOUTHWEST = new Direction("sw")
const E = EAST
const W = WEST
const NE = NORTHEAST
const NW = NORTHWEST
const SE = SOUTHEAST
const SW = SOUTHWEST

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

const STEP_WEIGHT = Modes.FAST
const numberHelper = async (target: number): Promise<string> => {
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
        if (steps % 1000 === 0) {
            const end = Date.now()
            console.log(`${steps} steps, ${end - start}ms, ${frontier.length} frontier nodes, best is ${frontier[0][0]} (step ${frontier[0][1]}, ${frontier[0][2]})`)
            await yield_()
        }
        const next = frontier.shift()!
        if (next[2] === target) {
            const end = Date.now()
            console.log(`solution found in ${steps} steps, took ${end - start}ms`)
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

    public queryByName(name: string): CSVRow<CSVFile<SpellDatabaseSchema>> {
        const row = this.sources.rows.find(row => row.translation === name)
        if (!row) throw new Error(`Could not locate "${name}"`)
        return row
    }

    public async generateNumber(theNumber: number) {
        console.debug("building number: " + theNumber)
        const plus = SE.apply("aqaa")
        const minus = NE.apply("dedd")
        if (theNumber >= 0) return plus.extend(await numberHelper(theNumber))
        else return minus.extend(await numberHelper(-theNumber))
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

const TABLE_SRC = 'https://hexxy.media/patterns.csv'
async function getSpellMeta() {
    const resp = await fetch(TABLE_SRC)
    const text = await resp.text()
    const data = parseCSV(text, SpellDatabaseSchema)
    return data
}

import * as readline from 'node:readline/promises';  // This uses the promise-based APIs
import { stdin as input, stdout as output } from 'node:process';
import { setMaxIdleHTTPParsers } from 'node:http'

async function initDatabases() {
    const rawDatabase = await getSpellMeta()
    const database = new SpellDatabase(rawDatabase)

    const rl = readline.createInterface({ input, output });

    const answer = await rl.question('enter a number: ');
    console.log(await database.generateNumber(+answer!))
    rl.close()
}

async function testOverlap() {
    const rl = readline.createInterface({ input, output });
    try {
        while (true) {
            const answer = await rl.question('enter a path: ');
            console.log(answer, 'overlap?', doesPathOverlap(answer!))
        }
    } finally {
        rl.close()
    }
}

// testOverlap()
initDatabases()