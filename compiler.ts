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
    constructor(public direction: Direction, public pattern: string) {}
    public extend(path: string): Pattern {
        return new Pattern(this.direction, this.pattern + path)
    }
}

class Direction {
    constructor(public name: string) {}
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

const doesPathOverlap = (path: string): boolean => {
    const cursor = [0, 0]
    let facing = 0
    const facingDir = ['e', 'se', 'sw', 'w', 'nw', 'ne']
    const segments: [[number, number], [number, number]][] = []
    const literal: string[] = []
    for (const direction in path.split('')) {
        switch(direction) {
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
        facing = facing % 6
        literal.push(facingDir[facing])
    }
    return true
}

const numberHelper = (target: number): string => {
    // current heuristic: <no-of-steps plus 1> * <abs distance from target>
    function cost(step: number, x: number) {
        return step * Math.abs(x - target)
    }
    let frontier: [number, number, string][] = [
        [cost(1, 0), 0, ""]
    ]
    let visited: number[] = []
    function getNexts(from: [number, number, string]) {
        const [step, current, path] = from
        let possibilites: [number, number, string][] = [
            [cost(step + 1, current + 5), current + 5, path + "q"], // slight left
            [cost(step + 1, current + 1), current + 1, path + "w"], // forward
            [cost(step + 1, current + 10), current + 10, path + "e"], // slight right
        ]
        if (step > 1) {
            possibilites = possibilites.concat([
                [cost(step + 1, current * 2), current * 2, path + "a"], // sharp left
                [cost(step + 1, current / 2), current / 2, path + "d"], // sharp right
            ])
        }
        return possibilites
    }

    while (frontier.length > 0) {
        // sort by cost, ascending
        frontier.sort((a, b) => a[0] - b[0])
        const next = frontier.shift()!
        if (next[1] === target) return next[2]
        if (visited.includes(next[1])) continue
        visited.push(next[1])
        frontier = frontier.concat(getNexts(next))
    }
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

    public generateNumber(theNumber: number) {
        console.debug("building number: " + theNumber)
        const plus = SE.apply("aqaa")
        const minus = NE.apply("dedd")
        if (theNumber >= 0) return plus.extend(numberHelper(theNumber))
        else return minus.extend(numberHelper(-theNumber))
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

async function initDatabases() {
    const rawDatabase = await getSpellMeta()
    const database = new SpellDatabase(rawDatabase)
    console.log(database.generateNumber(1024))
}

initDatabases()