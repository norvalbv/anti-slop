import { RuleTester } from "oxlint/plugins-dev";

import { noUnsafeDictionaryTypeRule } from "./no-unsafe-dictionary-type.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const error = { messageId: "unsafeDictionary" };

// Each level doubles the work of a resolver that re-expands a repeated argument.
const nested = (wrapper: string, depth: number, inner: string): string =>
	Array.from({ length: depth }).reduce<string>((type) => `${wrapper}<${type}>`, inner);
// `A{k}<T>` instantiates `A0` 2^k times, so only an expansion budget bounds it.
const selfComposed = (depth: number): string =>
	Array.from({ length: depth }, (_, k) => `type A${k + 1}<T> = A${k}<A${k}<T>>;`).join(" ");

/** An alias whose value is a 2^13-member union, used bare `uses` times; each use once cost a full walk. */
function manyBareUses(value: string, uses: number): string {
	const chain = Array.from({ length: 13 }, (_, index) => `type A${index + 1} = A${index} | A${index};`);
	const lets = Array.from({ length: uses }, (_, index) => `let use${index}: D;`);
	return ["type A0 = { id: string };", ...chain, `type D = Record<string, ${value}>;`, ...lets].join("\n");
}

tester.run("anti-slop/no-unsafe-dictionary-type", noUnsafeDictionaryTypeRule, {
	valid: [
		"type Commands = Record<string, Command>;",
		"type Metadata = Record<PropertyKey, JsonValue>;",
		"type PermissionLevels = Record<Permission, number>;",
		"type Indexed = { [key: string]: Command };",
		"type CompatibleIndexes = { [index: number]: Command; [key: string]: Command | OtherCommand };",
		"type Exhaustive = { [K in Permission]: number };",
		"type Allowed = Record<string, { payload: unknown }>;",
		"type AlsoAllowed = Record<string, Result<Data, unknown>>;",
		"type Index<T> = Record<string, T>; type EntityIndex<T extends Entity> = Record<string, T>;",
		"type Safe = Index<Command>; type Index<T> = Record<string, T>;",
		"type A = Map<string, unknown>; type B = ReadonlyMap<string, unknown>; type C = WeakMap<object, unknown>;",
		"import type { Record } from './local'; type A = Record<string, unknown>;",
		"import { type Record } from './local'; type A = Record<string, unknown>;",
		"interface Record<K, V> { key: K; value: V } type A = Record<string, unknown>;",
		"type Record<K, V> = { key: K; value: V }; type A = Record<string, unknown>;",
		"type Readonly<T> = { value: T }; type A = Record<string, Readonly<unknown>>;",
		"type NonNullable<T> = { value: T }; type A = Record<string, NonNullable<unknown>>;",
		"type Value<T> = T; type Index<T = Command, U = Value<T>> = Record<string, U>; type A = Index;",
		"interface Owner { readonly id: string } type A = Record<string, unknown & Owner>;",
		"interface Owner { readonly id: string } interface Child extends Owner {} type A = Record<string, Child>;",
		"interface Owner { readonly id: string } interface Child extends Owner { readonly __brand?: never } type A = Record<string, Child>;",
		"interface Escape {} interface Escape { readonly id: string } type A = Record<string, Escape>;",
		"interface Escape { readonly id: string } interface Escape {} type A = Record<string, Escape>;",
		"interface Owner { readonly id: string } type A = Record<string, object & Owner>;",
		"type Wrap<T> = { readonly wrapped: T }; type Inner<T, U> = { readonly value: T } & Wrap<U>; type Outer<T, U> = Record<string, Inner<T, U>>; declare function f<T, U>(): Outer<T, U>;",
		"type WithSchema<T extends Record<string, unknown>> = (schema: T) => void;",
		"function run<T extends Record<string, unknown>>(input: T): T { return input; }",
		"declare class Store<T extends Record<string, unknown>> { read(): T }",
		"type Deep<T extends Readonly<Record<string, unknown>>> = T;",
		"type T = Command; type Body = Record<string, T>; type Outer<T> = Body; type A = Outer<unknown>;",
		"type Box<T> = Record<string, T>; type ReadonlyBox<T> = Box<Readonly<T>>; type Safe = ReadonlyBox<{ id: string }>;",
		"type A<T = T> = Record<string, T>; type B = A;",
		"type A<T = U, U = T> = Record<string, T>; type B = A;",
		"type A<T = Readonly<T>> = Record<string, T>; type B = A;",
		"type Identity<T> = T; type Wrapped<T> = Identity<Readonly<T>>; type Values = Record<string, Wrapped<string>>;",
		"const holder = class Record { value: Record; };",
		"type Dict<T = string> = Record<string, T>; let value: Dict;",
		"type Dict<T = Command> = Record<string, T>; function f(value: Dict) {}",
		"type Dict<T> = Record<string, T>; let value: Dict<Command>;",
		"type Dict<T> = Record<string, T>; function f<U>(value: Dict<U>) {}",
		"type Dict<T> = Record<string, T>; let value: Dict;",
		"type Dict<T = Command> = Record<string, T>; let v: Partial<Dict>;",
		"type Ok = (Record<string, Command>);",
		"type Dict<T = unknown> = Record<string, T>; function f<T>(value: Dict<T>) {}",
		"type Dict<T = unknown> = Map<string, T>; let value: Dict;",
		"type Handler<T = unknown> = (value: T) => void; let handler: Handler;",
		`type Two<T> = T | T; type Values = Record<string, ${nested("Two", 30, "Command")}>;`,
		`type A0<T> = T | T; ${selfComposed(30)} type Values = Record<string, A30<Command>>;`,
		"type Box<T = Record<string, Command>> = T; let value: Box;",
		manyBareUses("A13", 6000),
	],
	invalid: [
		// A value or namespace import named Record leaves the global Record type in place.
		{ code: "import { Record } from 'effect'; type A = Record<string, unknown>;", errors: [error] },
		{ code: "import * as Record from 'effect/Record'; type A = Record<string, unknown>;", errors: [error] },
		{ code: "import Readonly from './readonly'; type A = Record<string, Readonly<unknown>>;", errors: [error] },
		{
			code: `type Two<T> = T | T; type Id<T> = T; type Values = Record<string, ${nested("Two", 30, "Command")} | Id<unknown>>;`,
			errors: [error],
		},
		{ code: "type Maybe<T> = T | null; type Values = Record<string, Maybe<Maybe<unknown>>>;", errors: [error] },
		{
			code: "type Maybe<T> = T | null; type Box<T> = Record<string, T>; type Values = Box<Maybe<Maybe<unknown>>>;",
			errors: [error],
		},
		{ code: "const holder = class Record {}; type A = Record<string, unknown>;", errors: [error] },
		{ code: "const holder = class Record {}; function later() { type A = Record<string, unknown>; }", errors: [error] },
		{ code: "type A = Record<string, unknown>;", errors: [error] },
		{
			code: "type Inner<A extends PropertyKey, B> = Record<A, B>; type Outer<A, B extends PropertyKey> = Inner<B, A>; type Unsafe = Outer<unknown, string>;",
			errors: [error],
		},
		{
			code: "type Box<T> = Record<string, T>; type Wrap<T> = Box<T>; type Unsafe = Wrap<unknown>;",
			errors: [error],
		},
		{ code: "type A = { [key: string]: any };", errors: [error] },
		{ code: "type A = { [index: number]: Command; [key: string]: unknown | Command };", errors: 1 },
		{ code: "type A = { [K in PropertyKey]: object };", errors: [error] },
		{ code: "type A = { [K in PropertyKey]: NonNullable<unknown> };", errors: [error] },
		{ code: "type A = { [key: string]: NonNullable<unknown> };", errors: [error] },
		{ code: "type A = Record<string, {}>;", errors: [error] },
		{ code: "interface Escape {} type A = Record<string, Escape>;", errors: [error] },
		{
			code: "interface Escape { readonly __brand?: never } type A = Record<string, Escape>;",
			errors: [error],
		},
		{
			code: "type Escape = { readonly __brand?: never }; type A = Record<string, Escape>;",
			errors: [error],
		},
		{ code: "type A = Record<string, { readonly __brand?: never }>;", errors: [error] },
		{ code: "type A = Record<string, string | unknown>;", errors: [error] },
		{ code: "interface Escape {} type A = Record<string, string | Escape>;", errors: [error] },
		{ code: "type A = Record<string, unknown & {}>;", errors: [error] },
		{
			code: "interface Owner { readonly id: string } type A = Record<string, any & Owner>;",
			errors: [error],
		},
		{ code: "type Escape = unknown; type A = Record<string, Escape>;", errors: [error] },
		{ code: "type Dict = Record<string, unknown>;", errors: [error] },
		{ code: "type A = Readonly<Partial<Required<(Record<string, unknown>)>>>;", errors: [error] },
		{ code: "type A = { readonly [key: string]: unknown };", errors: [error] },
		{ code: "type A = { readonly [K in string]: unknown };", errors: [error] },
		{ code: "type Source = Record<string, unknown>; type A = Pick<Source, string>;", errors: 2 },
		{ code: "type Source = Record<string, unknown>; type A = Omit<Source, never>;", errors: 2 },
		{ code: "type Index<T> = Record<string, T>; type A = Index<unknown>;", errors: 1 },
		{ code: "interface A { [key: string]: unknown }", errors: [error] },
		{ code: "type A = Readonly<Record<string, unknown>>;", errors: 1 },
		{ code: "type A = Record<string, Readonly<unknown>>;", errors: [error] },
		{ code: "type A = Record<string, Partial<unknown>>;", errors: [error] },
		{ code: "type A = Record<string, Required<unknown>>;", errors: [error] },
		{ code: "type Escape = Readonly<unknown>; type A = Record<string, Escape>;", errors: 1 },
		{
			code: "type Wrapped<T> = Readonly<T>; type A = Record<string, Wrapped<unknown>>;",
			errors: 1,
		},
		{ code: "type A = Record<string, NonNullable<unknown>>;", errors: [error] },
		{ code: "type Escape = NonNullable<unknown>; type A = Record<string, Escape>;", errors: 1 },
		{
			code: "type Unsafe = Record<string, unknown>; const x: Unsafe = {}; const y: Unsafe = {};",
			errors: 1,
		},
		{
			code: "type Unsafe = Record<string, unknown>; type AlsoUnsafe = Unsafe; const x: Unsafe = {};",
			errors: 2,
		},
		{ code: "type Index<T = unknown> = Record<string, T>; type A = Index;", errors: 1 },
		{
			code: "type Index<T, U = T> = Record<string, U>; type A = Index<string, unknown>;",
			errors: 1,
		},
		{ code: "type Index<T, U = T> = Record<string, U>; type A = Index<unknown>;", errors: 1 },
		{
			code: "type Value<T> = T; type Index<T, U = Value<T>> = Record<string, U>; type A = Index<unknown>;",
			errors: 1,
		},
		{
			code: "type Marker<T> = { readonly __brand?: never }; type Index<T, U = Marker<T>> = Record<string, U>; type A = Index<Item>;",
			errors: 1,
		},
		{
			code: "function outer() { type Identity<T> = T; type A = Record<string, Identity<unknown>>; }",
			errors: 1,
		},
		{
			code: "function local() { type Record<K, V> = { key: K; value: V }; type A = Record<string, unknown>; } function global() { type A = Record<string, unknown>; }",
			errors: 1,
		},
		{ code: "type Dict<T = unknown> = Record<string, T>; let value: Dict;", errors: [error] },
		{ code: "type Dict<T = any> = { [key: string]: T }; function f(value: Dict) {}", errors: [error] },
		{ code: "type Dict<T = object> = Record<string, T>; interface Holder { value: Dict }", errors: [error] },
		{
			code: "type Dict<K extends string = string, V = unknown> = Record<K, V>; let value: Dict;",
			errors: [error],
		},
		{ code: "type Dict<T = unknown> = Record<string, T>; let a: Dict; let b: Dict;", errors: [error, error] },
		{ code: "type Dict = Record<string, unknown>; let value: Dict;", errors: [error] },
		{ code: "type Dict<T = unknown> = Record<string, T>; let value: Dict<unknown>;", errors: [error] },
		{ code: "type Dict<T = unknown> = Record<string, T>; let v: Partial<Dict>;", errors: [error] },
		{ code: "type Dict<T = string> = Record<string, unknown> & { tag: T }; let v: Dict;", errors: [error] },
		{
			code: "type Inner<T = unknown> = Record<string, T>; type Dict<U = Command> = Inner; let v: Dict;",
			errors: [error],
		},
		{ code: "type Dict<T = string> = Record<string, unknown>; let value: Dict;", errors: [error] },
		{ code: "type Bad = (Record<string, unknown>);", errors: [error] },
		{ code: "function f(input: (Record<string, any>)) {}", errors: [error] },
		{
			code: "type Props<P extends object = Record<string, unknown>> = Readonly<P>; function c(p: Props) {} function d(p: Props) {}",
			errors: 1,
		},
		{ code: "type Box<T = Record<string, unknown>> = T; let a: Box; let b: Box;", errors: 1 },
		{ code: "type Pickish<T = Record<string, unknown>> = Pick<T, keyof T>; let value: Pickish;", errors: 1 },
		{ code: "type Box<U = unknown, T = Record<string, U>> = T; let value: Box;", errors: 1 },
		{
			code: "type D<T = unknown> = Record<string, T | Record<string, unknown>>; let value: D;",
			errors: 2,
		},
		{ code: manyBareUses("A13 | unknown", 6000), errors: 1 },
	],
});
