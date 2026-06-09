import { Logger, LogLevel } from "@andrewheberle/ts-slog"
import { EnvBindings } from "./types"

export const logger = (env: EnvBindings) => {
    switch (env.LOG_LEVEL) {
        case "debug":
            return new Logger({ minLevel: LogLevel.Debug })
        case "error":
            return new Logger({ minLevel: LogLevel.Error })
        case "none":
            return new Logger({ minLevel: LogLevel.None })
        case "warning":
            return new Logger({ minLevel: LogLevel.Warning })
        default:
            return new Logger({ minLevel: LogLevel.Info })
    }
}