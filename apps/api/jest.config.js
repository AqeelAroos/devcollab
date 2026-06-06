const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Use TEST_DATABASE_URL if provided so tests don't clobber the dev database
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Ensure required env vars have fallbacks for tests
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
if (!process.env.GITHUB_CLIENT_ID) process.env.GITHUB_CLIENT_ID = "test-client-id";
if (!process.env.GITHUB_CALLBACK_URL)
  process.env.GITHUB_CALLBACK_URL = "http://localhost:4000/api/auth/github/callback";
if (!process.env.WEB_URL) process.env.WEB_URL = "http://localhost:3000";

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.test.json",
        // Skip type-checking source files during tests — transpile-only mode
        // mirrors how ts-node-dev runs in development (--transpile-only).
        diagnostics: false,
      },
    ],
  },
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
};
