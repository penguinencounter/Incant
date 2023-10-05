# Incant
An alternative text-based language (interface?) for Hex Casting + MoreIotas, implemented in Hex Casting

## Version 1.1 planned features
### more friendly HexBuild interface
* look less like a mix between a terminal and a tree viewer
* hide the internals
* provide build arguments to allow users to select operator list,
  library target, library key, etc that would normally be hardcoded
* provide support for parsing gz'd nbt
* allow injecting directly to the Everbook (if that addon is installed)
* allow injecting into the Creative Saved Toolbars
* drag-and-drop to add custom libraries
* merge libraries at build-time

### add `recharge` family to the standard library
* `recharge 0.00` -  `{rc3} Recharge Item`
* `recharge 1.00` - zone dist. Item, iterate `Recharge Item` on all

### better `blink`
* if the target is > 30, do it in 30 block increments to avoid
running out of ambit

### `gtp` and `gtpl`
* `gtp 1.00` - subtract player's current position, GTP
* `gtpl 1.00` - direct GTP
* `gtp 3.00` - build vector, subtract player's current position, GTP
* `gtpl 3.00` - build vector, direct GTP
* `gtp 2.00` (entity, vector) -> subtract entity's current position, GTP
* `gtpl 2.00` (entity, vector) -> direct GTP (why tho?)

### migrate single-use constants to embedded iotas
* `(` (done)
* `)` (done)
* `#` (done)
* `$` (done)
* `!` (not implemented)
* `?` (not implemented)
* `@` (not implemented)
* `~` (not implemented)
* operators (done)

## Hooks (read: preproccessor directies)
### `?hookName` - lexer hook
Runs during lexing. Can append and modify the already processed tokens.

### `!hookName` - compiler hook
Runs at compile time. Can modify previously built code.

### Unknown opcodes -> compiler macros
If the compiler encounters an unknown opcode, it will check for a compiler macro with the same name.
i.e. opcode `9.00` (as of yet unassigned) will try to invoke `9.00!` with the token on top of the stack.

## @Functions
Opcode `10.00` - syntactical sugar for a lookup

`@n` refers to the nth defined function.
Functions are defined with a compiler hook.
`!f` is included in the standard library to aid in the scripting process

## Stdlib hooks
**`!f`** *create a new function from the previous commands*<br>
Copies the compiler output and creates a new function from it,
then clears the compiled output.

**`!10.00`** *function operator opcode*<br>
Look up the referenced function and return it.

## Version 1.2 planned features
### lexer repeat action
`~<count>` repeats the previous token `<count>` times

doing this naively would cause massive jank with arguments or inline functions
therefore perhaps these steps would be better:
1. collect tokens until an `invokestore` is encountered
2. repeat the collected tokens `count - 1` times (leave the original in place)

## Current (very scuffed) build process:
1. `npx tsc` (add `-w` if you're actively developing)
2. `python server.py` (keep running for future use)
3. open [the server](http://localhost:8080) in your browser
4. Wait for build to finish, then press `Batch Export`
5. Run the generated commands in command blocks to spawn in foci
6. Use `/data` commands or manually merging the iotas with a staff to produce merged iota

## Defining fuctions
Function keys need to follow a specific form.
Here are some examples:
```
// :: <function-name> <argcount>.00
// if the function leaves a value on the stack, put a comma (,)
// after the argument count (no spaces)
```

Functions can be "overloaded" to support a variable number of arguments.
```
// this one launches the caster
// :: launch 1.00
// this one launches another entity
// :: launch 2.00
```

### Special functions (operators)
`TODO`

### Recommended standard libraries
Implementations and documentation coming soonTM
```
// simple operators
op + 2 r
op - 2 r
op * 2 r
op / 2 r
self 0 r
head 0 r
head 1 r
feet 0 r
feet 1 r
facing 0 r
facing 1 r
print 1

random 0 r
mkvec 3 r

select-entity 2 r
select-entities 2 r
select-animal 2 r
select-animals 2 r
select-monster 2 r
select-monsters 2 r
select-item 2 r
select-items 2 r
select-player 2 r
select-players 2 r
select-living 2 r
select-livings 2 r
select-not-living 2 r
select-not-livings 2 r

first 1 r
last 1 r
index 2 r
set-or 2 r
set-and 2 r
set-xor 2 r
unique 1 r

read-entity 1 r
write-entity 2

// spells
// TODO: Shorten this up (both command length and count)
explode 2
fireball 2
launch 1 (default: self)
launch 2 
blink 1 (default: self)
blink 2
place 1
break 1
place-water 1
remove-liquid 1
conjure-block 1
conjure-light 1
grow 1
edify 1
ignite 1
extinguish 1
// you could implement the nadirs here in your own library
sentinel 1
rm-sentinel 1
loc-sentinel 0 r

// load your world's great spells into your library
// to use them

// constants
true 0 r
false 0 r
null 0 r
ZERO 0 r
EAST 0 r (+X)
WEST 0 r (-X)
UP 0 r (+Y)
DOWN 0 r (-Y)
SOUTH 0 r (+Z)
NORTH 0 r (-Z)
PI 0 r
TAU 0 r
E 0 r

// common actions
rc-vec 0 r
rc-vec 1 r
rc-ent 0 r
rc-ent 1 r

// spell debugging
dump-autorefs 0
dump-stack 0
dump-cache 0

// persistant storage
save 1
load 0 r
load 1 r
load-copy 0 r
load-copy 1 r
wipe-storage 0
count-storage 0 r
dump-storage 0

// temporary storage
stash 1
stash-pop 0 r
stash-clear 0

// autoref ($0, $1, ...) manipulation
reset-autorefs 0
discard 0
```
