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

const numberHelper = (number: number) => {
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

    private numberHelper(number: number) {
        return "w".repeat(number)
    }

    public generateNumber(theNumber: number) {
        console.debug("building number: " + theNumber)
        const plus = SE.apply("aqaa")
        const minus = NE.apply("dedd")
        if (theNumber >= 0) return plus.extend(this.numberHelper(theNumber))
        else return minus.extend(this.numberHelper(-theNumber))
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
    console.log(database.generateNumber(-16))
}

initDatabases()