import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import { existsSync, readFileSync } from "node:fs";

const envPath = new URL(".env", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match === null || process.env[match[1]] !== undefined) {
      continue;
    }
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const ritualPrivateKey = process.env.RITUAL_PRIVATE_KEY;
if (ritualPrivateKey === undefined || ritualPrivateKey === "0x") {
  throw new Error("Set RITUAL_PRIVATE_KEY in hardhat/.env before using the ritual network.");
}

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // Ritual Chain testnet. Requires EIP-1559 (type-2) transactions; viem sends
    // those by default.
    ritual: {
      type: "http",
      chainType: "l1",
      chainId: 1979,
      url: process.env.RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org",
      accounts: [ritualPrivateKey],
    },
  },
});
