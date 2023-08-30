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

class Direction {
    constructor(public name: string) {}
    public apply(path: string): Pattern {
        return  {
            direction: this,
            pattern: path
        }
    }
}

const EAST = new Direction("east")
type Pattern = {
    direction: Direction,
    pattern: string
}

const test = EAST.apply("sdfsdf")
//      ^?

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
        const forward = EAST.
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
    console.log(database.queryByName("Numerical Reflection"))
}

initDatabases()