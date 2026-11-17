import { RuleTester } from "oxlint/plugins-dev";

import { noUnknownReturnsRule } from "./no-unknown-returns.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "unknownReturn" };

// Each level doubles the work of a resolver that re-expands a repeated argument.
const nested = (wrapper: string, depth: number, inner: string): string =>
  Array.from({ length: depth }).reduce<string>((type) => `${wrapper}<${type}>`, inner);
// `A{k}<T>` instantiates `A0` 2^k times, so only an expansion budget bounds it.
const selfComposed = (depth: number): string =>
  Array.from({ length: depth }, (_, k) => `type A${k + 1}<T> = A${k}<A${k}<T>>;`).join(" ");

tester.run("anti-slop/no-unknown-returns", noUnknownReturnsRule, {
  valid: [
    "type ImportedValue = unknown;",
    "function parse(): ImportedValue { return input; }",
    "function parse(): User { return user; }",
    "function infer() { return input; }",
    "function generic<Value>(): Value { return value; }",
    "type Value = unknown; function generic<Value>(): Value { return value; }",
    "type Key = unknown; type Mapped<Input> = { [Key in keyof Input]: () => Key };",
    "type Item = unknown; type Unpacked<Input> = Input extends Promise<infer Item> ? () => Item : never;",
    "function cause(): { cause: unknown } { return { cause: input }; }",
    "type Result = { value: unknown }; function load(): Result { return result; }",
    "function load(): Promise<User> { return promise; }",
    "type Identity<T> = T; function load(): Identity<User> { return user; }",
    "type Value = unknown; function outer() { type Value = User; function load(): Value { return user; } }",
    "type T = User; type Body = T; type Outer<T> = Body; function load(): Outer<unknown> { return user; }",
    "export function wrap<THook extends (...args: never[]) => unknown>(hook: THook): THook { return hook; }",
    "export type Wrapped<THook extends () => unknown = () => unknown> = { hook: THook };",
    "type FnConstraint<T extends () => unknown> = T;",
    "type FnDefault<T = () => unknown> = T;",
    "interface Wrapper<T extends (...args: any[]) => unknown> { handler: T; }",
    `export function read(key: "count"): number;
export function read(key: "label"): string;
export function read(key: string): unknown { return registry.get(key); }`,
    `class Registry {
  read(key: "count"): number;
  read(key: "label"): string;
  read(key: string): unknown { return registry.get(key); }
}`,
    `export default function read(key: "count"): number;
export default function read(key: string): unknown { return registry.get(key); }`,
    `export default function (key: "count"): number;
export default function (key: string): unknown { return registry.get(key); }`,
    `class Registry {
  "read"(key: "count"): number;
  "read"(key: string): unknown { return registry.get(key); }
}`,
    `class Registry {
  0(key: "count"): number;
  0(key: string): unknown { return registry.get(key); }
}`,
    `class Registry {
  static {
    function read(key: "count"): number;
    function read(key: string): unknown { return registry.get(key); }
  }
}`,
    "export interface PromiseLike<T> { value: string } export function load(): PromiseLike<unknown> { return value; }",
    "export interface Promise<T> { value: string } export function load(): Promise<unknown> { return value; }",
    "export class Promise<T> { value = '' } export function load(): Promise<unknown> { return value; }",
    "import type { PromiseLike } from './local'; export function load(): PromiseLike<unknown> { return value; }",
    "export interface PromiseLike<T> { value: string } export type Loader = () => PromiseLike<unknown>;",
    "export interface PromiseLike<T> { value: string } type Wrap<T> = T; export function load(): Wrap<PromiseLike<unknown>> { return value; }",
    "export interface PromiseLike<T> { value: string } type Async<T> = PromiseLike<T>; export function load(): Async<unknown> { return value; }",
    "function outer() { interface Promise<T> { value: string } function load(): Promise<unknown> { return value; } }",
    `type Two<T> = T | T; function load(): ${nested("Two", 30, "string")} { return value; }`,
    `type A0<T> = T | T; ${selfComposed(30)} function load(): A30<string> { return value; }`,
  ],
  invalid: [
    {
      code: `type Two<T> = T | T; type Id<T> = T; function load(): ${nested("Two", 30, "string")} | Id<unknown> { return value; }`,
      errors: [error],
    },
    { code: "type Maybe<T> = T | null; function load(): Maybe<Maybe<unknown>> { return input; }", errors: [error] },
    {
      code: "type T = unknown; type Body = T; type Outer<T> = Body; function load(): Outer<User> { return user; }",
      errors: [error],
    },
    { code: "function load(): unknown { return input; }", errors: [error] },
    { code: "const load = (): unknown => input;", errors: [error] },
    { code: "type Loader = () => unknown;", errors: [error] },
    { code: "interface Loader { load(): unknown }", errors: [error] },
    { code: "declare function load(): unknown;", errors: [error] },
    { code: "function load(): string | unknown { return input; }", errors: [error] },
    { code: "function load(): Promise<unknown> { return promise; }", errors: [error] },
    { code: "type UnknownValue = unknown; function load(): UnknownValue { return input; }", errors: [error] },
    { code: "type Item = unknown; type Fallback<Input> = Input extends infer Item ? string : () => Item;", errors: [error] },
    {
      code: "function outer() { type Result = unknown; function load(): Result { return input; } }",
      errors: [error],
    },
    {
      code: "type Identity<T> = T; function load(): Identity<unknown> { return input; }",
      errors: [error],
    },
    {
      code: "type Identity<T> = T; type Wrapped<T> = Promise<Identity<T>>; function load(): Wrapped<unknown> { return promise; }",
      errors: [error],
    },
    {
      code: "export function wrap<THook extends (...args: never[]) => unknown>(hook: THook): unknown { return hook; }",
      errors: [error],
    },
    {
      code: "type MyFn = <T extends () => unknown>() => unknown;",
      errors: [error],
    },
    {
      code: `export function read(key: "count"): unknown;
export function read(key: string): unknown { return registry.get(key); }`,
      errors: [error],
    },
    {
      code: `class Registry {
  read(key: "count"): unknown;
  read(key: string): unknown { return registry.get(key); }
}`,
      errors: [error],
    },
    {
      code: `export default function read(key: "count"): unknown;
export default function read(key: string): unknown { return registry.get(key); }`,
      errors: [error],
    },
    {
      code: `export function load(key: "count"): number;
export default function (key: string): unknown { return registry.get(key); }`,
      errors: [error],
    },
    {
      code: `class Registry {
  "read"(key: "count"): unknown;
  "read"(key: string): unknown { return registry.get(key); }
}`,
      errors: [error],
    },
    { code: "export function load(): PromiseLike<unknown> { return value; }", errors: [error] },
    {
      code: "function outer() { interface PromiseLike<T> { value: string } } export function load(): PromiseLike<unknown> { return value; }",
      errors: [error],
    },
    {
      code: "declare global { interface PromiseLike<T> { extra(): void } } export function load(): PromiseLike<unknown> { return value; }",
      errors: [error],
    },
    { code: "type Async<T> = Promise<T>; export function load(): Async<unknown> { return value; }", errors: [error] },
    {
      code: "export interface PromiseLike<T> { value: string } export function load(): Promise<unknown> { return value; }",
      errors: [error],
    },
    {
      code: "export interface Promise<T> { value: string } export function load(): Promise<string> | unknown { return value; }",
      errors: [error],
    },
    {
      code: "function load<T>(): Promise<unknown> { return promise; } interface Promise2<Promise> { value: Promise }",
      errors: [error],
    },
  ],
});

