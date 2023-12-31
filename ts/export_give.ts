// { data: { 'hexcasting:type': 'list', 'hexcasting:data': [ {'hexcasting:type': 'pattern', 'hexcasting:data': { startDir: 0b, angles: [B;] } } ] } }

import { Iota, ListIota } from "./iotas.js"

// startAngle
// Northeast => 0
// East => 1
// Southeast => 2
// Southwest => 3
// West => 4
// Northwest => 5

// angles
// 4 => sharp left
// 5 => slight left
// 0 => straight
// 1 => slight right
// 2 => sharp right
// 3 => reverse (invalid lmao)

function shorthandToNBT(shorthand: string) {
    const startAngle = {
        ne: 0,
        e: 1,
        se: 2,
        sw: 3,
        w: 4,
        nw: 5
    }, angle = {
        a: 4,
        q: 5,
        w: 0,
        e: 1,
        d: 2,
        s: 3
    }
    const match = /<([sn]?[ew]),([aqweds]*)>/.exec(shorthand)!
    const startDir = startAngle[match[1] as keyof typeof startAngle]
    const angles = match[2].split('').map(c => angle[c as keyof typeof angle])
    return `{"hexcasting:type":"hexcasting:pattern","hexcasting:data":{startDir:${startDir}b,angles:[B;${angles.map(e => e + 'b').join(',')}]}}`
}

function targetGive(list_of_patterns: string) {
    const patterns = list_of_patterns.split(';').map(shorthandToNBT)
    return `give @p hexcasting:focus{data:{"hexcasting:type":"hexcasting:list","hexcasting:data":[${patterns.join(',')}]}}`
}

function procedural(list_of_patterns: string) {
    const LIM = 32_000
    const patterns = list_of_patterns.split(';')
    const commands = []
    let collect: string[] = []
    for (let i = 0; i < patterns.length; i += 1) {
        collect.push(patterns[i])
        const c = targetGive(collect.join(';'))
        if (c.length > LIM) {
            collect.pop()
            commands.push(targetGive(collect.join(';')))
            collect = [patterns[i]]
        }
    }
    if (collect.length > 0)
        commands.push(targetGive(collect.join(';')))
    for (const c of commands) {
        console.log(c)
    }
    const capacityReal = LIM - commands[commands.length - 1].length
    const capacity = Math.round(capacityReal / LIM * 1000)/10
    console.log(`${commands.length} commands, ${capacity}% capacity (${capacityReal} chars) in last command`)
}

function giveTempl(content: string) {
    // return `give @p hexcasting:focus{data:${content}}`
    return `summon item ~ ~0.6 ~ {Item:{id:"hexcasting:focus",Count:1b,tag:{data:${content}}}}`
}

function give2(iota: Iota): string[] {
    if (!(iota instanceof ListIota)) {
        console.log('not a list iota, cannot split')
        return [giveTempl(iota.asNBT())]
    }
    const LIM = 32_000
    const parts = iota.data
    const commands: string[] = []
    let collect: Iota[] = []
    for (let i = 0; i < parts.length; i += 1) {
        collect.push(parts[i])
        const partial = new ListIota(collect)
        const c = giveTempl(partial.asNBT())
        if (c.length > LIM) {
            collect.pop()
            const partial2 = new ListIota(collect)
            commands.push(giveTempl(partial2.asNBT()))
            collect = [parts[i]]
        }
    }

    if (collect.length > 0)
        commands.push(giveTempl(new ListIota(collect).asNBT()))
    
    const capacityReal = LIM - commands[commands.length - 1].length
    const capacity = Math.round(capacityReal / LIM * 1000)/10
    console.log(`${commands.length} commands, ${capacity}% capacity (${capacityReal} chars) in last command`)
    return commands
}

declare global {
    interface Window {
        s2n: typeof shorthandToNBT
        give: typeof procedural
        give2: typeof give2
    }
}
window.s2n = targetGive
window.give = procedural
window.give2 = give2

export {
    shorthandToNBT
}
