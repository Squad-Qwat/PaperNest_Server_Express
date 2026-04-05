/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/**/*.d.ts",
		"!src/types/**",
		"!src/server.ts",
		"!src/app.ts",
	],
	coverageThreshold: {
		global: {
			statements: 80,
			branches: 70,
			functions: 80,
			lines: 80,
		},
	},
	coverageDirectory: "coverage",
	verbose: true,
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
	setupFilesAfterEnv: ["<rootDir>/src/tests/setup.ts"],
	moduleNameMapper: {
		"\\.d\\.ts$": "<rootDir>/src/tests/setup.ts", // Map .d.ts imports to an empty file
		"^@/(.*)$": "<rootDir>/src/$1",
	},
};
