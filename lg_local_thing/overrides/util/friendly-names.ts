import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type FriendlyIdentity = {
    name: string
    entityBase: string
}

type FriendlyNameDatabase = Record<string, FriendlyIdentity>

function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
}

export class FriendlyNameStore {
    private database: FriendlyNameDatabase | undefined

    constructor(
        private readonly filePath: string = process.env.RETHINK_FRIENDLY_NAMES_FILE ??
            '/data/state/friendly-names.json',
    ) {}

    private load(): FriendlyNameDatabase {
        if (this.database) return this.database

        try {
            const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as unknown

            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                throw new Error(`Invalid friendly-name database: ${this.filePath}`)

            const database: FriendlyNameDatabase = {}

            for (const [id, rawIdentity] of Object.entries(parsed as Record<string, unknown>)) {
                if (!rawIdentity || typeof rawIdentity !== 'object' || Array.isArray(rawIdentity))
                    throw new Error(`Invalid friendly-name record for ${id}`)

                const identity = rawIdentity as Record<string, unknown>

                if (typeof identity.name !== 'string' || typeof identity.entityBase !== 'string')
                    throw new Error(`Invalid friendly-name record for ${id}`)

                database[id] = {
                    name: identity.name,
                    entityBase: identity.entityBase,
                }
            }

            this.database = database
        } catch (err: any) {
            if (err?.code === 'ENOENT') {
                this.database = {}
            } else {
                throw err
            }
        }

        return this.database
    }

    get(id: string): FriendlyIdentity | undefined {
        const identity = this.load()[id]
        return identity ? { ...identity } : undefined
    }

    set(id: string, value: string): FriendlyIdentity {
        const name = value.trim()

        if (!name) throw new Error('Device name cannot be empty')
        if (name.length > 80) throw new Error('Device name cannot exceed 80 characters')

        const database = this.load()
        const current = database[id]

        let entityBase: string

        if (current) {
            /*
             * Once Home Assistant has created entities from this base it becomes structural.
             * Renaming the appliance later changes only the friendly display name.
             */
            entityBase = current.entityBase
        } else {
            entityBase = slugify(name)

            if (!entityBase)
                throw new Error('Device name must contain at least one letter or number')

            const conflictingDevice = Object.entries(database).find(
                ([otherId, identity]) => otherId !== id && identity.entityBase === entityBase,
            )

            if (conflictingDevice)
                throw new Error(
                    `Entity base "${entityBase}" is already assigned to another device`,
                )
        }

        const identity = { name, entityBase }
        database[id] = identity

        this.persist(database)

        return { ...identity }
    }

    private persist(database: FriendlyNameDatabase) {
        mkdirSync(dirname(this.filePath), { recursive: true })

        const temporaryPath = `${this.filePath}.tmp`

        writeFileSync(
            temporaryPath,
            JSON.stringify(database, null, 2) + '\n',
            {
                encoding: 'utf-8',
                mode: 0o600,
            },
        )

        renameSync(temporaryPath, this.filePath)
    }
}

export const friendlyNames = new FriendlyNameStore()
