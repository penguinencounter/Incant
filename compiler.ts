type ValOf<T> = T[keyof T]
type ArrayType<T> = T extends Array<infer U> ? U : never

type CSVFile<Scheme extends string[]> = {
    headers: Scheme,
    rows: {
        [header in ArrayType<Scheme>]: string | null | undefined
    }[]
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
            const obj2 = obj as Required<typeof obj>

            return obj2
        })
    }
}

const TABLE_SRC = 'https://hexxy.media/patterns.csv'
async function getSpellMeta() {
    const resp = await fetch(TABLE_SRC)
    const text = await resp.text()
    const data = parseCSV(text, ["mod", "translation", "direction", "pattern", "is_great", "modid", "name", "classname", "args", "book_anchor"])
}