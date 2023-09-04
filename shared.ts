class Pattern {
    constructor(public direction: Direction, public pattern: string) { }
    public extend(path: string): Pattern {
        return new Pattern(this.direction, this.pattern + path)
    }
    public last(): string {
        return this.pattern[this.pattern.length - 1]
    }
}

class Direction {
    constructor(public name: string) {}
    public apply(pattern: string) {
        return new Pattern(this, pattern)
    }
}
const
    SE = new Direction('se'),
    SW = new Direction('sw'),
    W = new Direction('w'),
    NW = new Direction('nw'),
    NE = new Direction('ne'),
    E = new Direction('e'),
    directions = { SE, SW, W, NW, NE, E, SOUTH_EAST: SE, SOUTH_WEST: SW, WEST: W, NORTH_WEST: NW, NORTH_EAST: NE, EAST: E }

function stripString(s: string): string {
    return s.replace(/^\s*(.*?)\s*$/, '$1')
}

function nodify(multiline: string): HTMLDivElement[] {
    const els = []
    for (const line of multiline.split('\n')) {
        const el = document.createElement('div')
        el.textContent = line
        els.push(el)
    }
    return els
}
export {
    Pattern,
    Direction,
    directions,
    stripString,
    nodify
}