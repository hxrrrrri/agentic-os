import path from "node:path";

export const agenticosConfig = {
  appName: "AgenticOS",
  vaultPath: process.env.AGENTICOS_VAULT_PATH ?? path.join(process.cwd(), "vault"),
  databasePath:
    process.env.AGENTICOS_DB_PATH ?? path.join(process.cwd(), ".agenticos", "agenticos.sqlite"),
  mode: process.env.AGENTICOS_MODE ?? "mock",
  defaultProvider: process.env.AGENTICOS_PROVIDER ?? "claude-code",
  budgets: {
    fiveHourTokens: 200_000,
    weeklyMinutes: 1_200,
    dailyRoutines: 25,
  },
  allowedCommandRoots: [process.cwd()],
};
