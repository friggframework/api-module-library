declare module "@friggframework/core" {
  export interface FriggModuleAuthDefinition {
    API: new (...args: any[]) => any;
    getName: () => string;
    moduleName: string;
    requiredAuthMethods: Record<string, any>;
    env?: Record<string, any>;
  }
}
