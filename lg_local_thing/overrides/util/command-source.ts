// Smart House diagnostic attribution, GPL v2. Scoped to synchronous packet emission.
export type CommandSource = 'ha' | 'lg' | 'local'
const sources = new Map<string, CommandSource>()
export function commandSource(id: string): CommandSource { return sources.get(id) ?? 'local' }
export function withCommandSource<T>(id: string, source: CommandSource, action: () => T): T {
    const previous = sources.get(id)
    sources.set(id, source)
    try { return action() }
    finally { if (previous) sources.set(id, previous); else sources.delete(id) }
}
