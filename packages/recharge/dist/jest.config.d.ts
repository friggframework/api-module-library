export const testEnvironment: string;
export const testMatch: string[];
export const transform: {
    '^.+\\.ts$': (string | {
        isolatedModules: boolean;
        tsconfig: {
            allowJs: boolean;
            strict: boolean;
            esModuleInterop: boolean;
            skipLibCheck: boolean;
        };
    })[];
};
export const moduleFileExtensions: string[];
export const collectCoverageFrom: string[];
export namespace coverageThreshold {
    namespace global {
        const branches: number;
        const functions: number;
        const lines: number;
        const statements: number;
    }
}
export const setupFilesAfterEnv: string[];
export const globalTeardown: string;
//# sourceMappingURL=jest.config.d.ts.map