"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Definition = exports.Api = void 0;
const api_1 = require("./api");
Object.defineProperty(exports, "Api", { enumerable: true, get: function () { return api_1.Api; } });
const definition_1 = __importDefault(require("./definition"));
exports.Definition = definition_1.default;
exports.default = { Api: api_1.Api, Definition: definition_1.default };
//# sourceMappingURL=index.js.map