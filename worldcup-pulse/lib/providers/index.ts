import type { FootballProvider } from "./types";
import { apiFootballProvider } from "./apiFootball";
import { footballDataProvider } from "./footballData";

// Single data provider in production (spec §0.1). The fallback is enabled
// via PROVIDER=football-data — a config switch, never both at once.
export function getProvider(): FootballProvider {
  return process.env.PROVIDER === "football-data"
    ? footballDataProvider
    : apiFootballProvider;
}
