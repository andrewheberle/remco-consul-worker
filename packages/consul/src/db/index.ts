import { D1QB } from "workers-qb"
import { migrations } from "./migrations"
import { EnvBindings } from "../types"
import { logger } from "../logger"

export type Schema = {
    access_controls: {
        id: number
        user: string
        prefix: string
    }
}

export const connect = async (env: EnvBindings): Promise<D1QB<Schema>> => {
    const l = logger(env)

    if (env.DB === undefined) {
        throw new Error("DB was undefined")
    }
    
    try {
        l.debug("connect(): starting connect process")

        const qb = new D1QB<Schema>(env.DB)

        l.debug("connect(): setting up migrationBuilder", "migrations", migrations)

        const migrationBuilder = qb.migrations({ migrations })

        l.debug("connect(): set up migrationBuilder", "migrations", migrations)
        
        const applied = await migrationBuilder.apply()

        l.debug("connect(): connected and applied migrations", "applied", applied.length, "total", migrations.length)

        return qb
    } catch (err) {
        l.error("connect(): error during connect and migration process", "error", err)
        throw err
    }
}
