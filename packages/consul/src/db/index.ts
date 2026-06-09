import { D1QB } from "workers-qb"
import { migrations } from "./migrations"

export type Schema = {
    access_controls: {
        id: number
        user: string
        prefix: string
    }
}

export const connect = async (db: D1Database): Promise<D1QB<Schema>> => {
    const qb = new D1QB<Schema>(db)
	const migrationBuilder = qb.migrations({ migrations })
	await migrationBuilder.apply()

    return qb
}
