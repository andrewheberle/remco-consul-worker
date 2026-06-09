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
    if (env.DB === undefined) {
        throw new Error("DB was undefined")
    }

    const l = logger(env)

    l.debug("connect(): connecting to database")

    const qb = new D1QB<Schema>(env.DB)
	const migrationBuilder = qb.migrations({ migrations })
	const applied = await migrationBuilder.apply()

    l.debug("connect(): connected and applied migrations", "applied", applied.length, "total", migrations.length)

    return qb
}
