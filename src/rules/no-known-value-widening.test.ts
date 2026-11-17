import { RuleTester } from "oxlint/plugins-dev";

import { noKnownValueWideningRule } from "./no-known-value-widening.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const error = { messageId: "widening" };

const prelude = "type Command = () => void; const startCommand = () => {};";

tester.run("anti-slop/no-known-value-widening", noKnownValueWideningRule, {
	valid: [
		`${prelude} type Key<T> = T; const commands: Record<Key<'start'>, Command> = { start: startCommand };`,
		`${prelude} type Key<T = 'start'> = T; const commands: Record<Key, Command> = { start: startCommand };`,
		`${prelude} const commands: Record<string, Command> = {};`,
		`${prelude} type Index<T> = Record<string, T>; const commands: Index<Command> = {};`,
		`${prelude} class Registry { commands: Record<string, Command> = {}; }`,
		`${prelude} class Registry { accessor commands: Record<string, Command> = {}; }`,
		`${prelude} let commands: Record<string, Command>; commands = {};`,
		`${prelude} function create(): Record<string, Command> { return {}; }`,
		`${prelude} const create = (): Record<string, Command> => ({});`,
		`${prelude} const commands = {} as Record<string, Command>;`,
		`${prelude} const commands = <Record<string, Command>>{};`,
		`${prelude} const commands = { start: startCommand };`,
		`${prelude} const commands = { start: startCommand } as const;`,
		`${prelude} const commands = { start: startCommand } satisfies Record<string, Command>;`,
		`${prelude} type Commands = Record<string, Command>; const commands = { start: startCommand } as const satisfies Commands;`,
		`${prelude} interface Commands { readonly start: Command } const commands: Commands = { start: startCommand };`,
		`${prelude} type Commands = { readonly start: Command }; const commands: Commands = { start: startCommand };`,
		`${prelude} type PermissionLevels = { readonly [Level in Permission]: number }; const levels: PermissionLevels = { admin: 1 };`,
		`${prelude} function create() { return { start: startCommand }; }`,
		`${prelude} interface Commands { readonly start: Command } function create(): Commands { return { start: startCommand }; }`,
		`${prelude} declare function make(): Record<string, Command>; const commands: Record<string, Command> = make();`,
		`${prelude} import { Commands } from './types'; const commands: Commands = { start: startCommand };`,
		`${prelude} type Diet = 'vegan' | 'omnivore'; const labels: Record<Diet, string> = { vegan: 'V', omnivore: 'O' };`,
		`${prelude} type Diet = 'vegan' | 'omnivore'; type Labels = Record<Diet, string>; const labels: Labels = { vegan: 'V', omnivore: 'O' };`,
		`${prelude} type Diet = 'vegan' | 'omnivore'; const labels: Readonly<Record<Diet, string>> = { vegan: 'V', omnivore: 'O' };`,
		`${prelude} const labels: Record<'a' | 'b', number> = { a: 1, b: 2 };`,
		`${prelude} type Index<Key extends PropertyKey, Value> = Record<Key, Value>; const commands: Index<'start', Command> = { start: startCommand };`,
		"function isString(value: unknown): value is string { return true; } declare const input: unknown; isString(input);",
		"function isString(value: string | unknown): value is string { return true; } declare const input: string | unknown; isString(input);",
		"function isString(value: unknown): value is string { return true; } declare function readInput(): unknown; isString(readInput());",
		"type A<T = T> = T; const value: A = { a: 'x' };",
		"type A<T = U, U = T> = Record<T, string>; const value: A = { a: 'x' };",
		'type Identity<T> = T; type Wrapped<T> = Identity<Readonly<T>>; const value: Wrapped<string> = "x";',
		'type Pair<T, U extends PropertyKey> = Record<U, T>; type Outer<T extends PropertyKey, U extends PropertyKey> = Pair<U, T>; const closedKey: Outer<"a", string> = { a: "x" };',
		`${prelude} type Keys = "start"; type K = Keys; type Dict<V> = Record<K, V>; type Outer<K> = Dict<Command>; const commands: Outer<string> = { start: startCommand };`,
		`${prelude} type Second<T, U> = U; type Outer<T, U> = Record<Second<U, T>, Command>; const commands: Outer<"start", string> = { start: startCommand };`,
		`${prelude} type Key<T> = T; function build<T extends string>(extra: Record<T, Command>) { const all: Record<Key<T | "start">, Command> = { ...extra, start: startCommand }; return all; }`,
		'type Field<K extends string> = K; type Form<K extends string> = Record<Field<K | "id">, string>; const form: Form<"name"> = { id: "1", name: "x" };',
		"function isString(value: unknown): value is string { return typeof value === 'string'; } export function describe(value: string | number): string { return isString(value) ? value : String(value + 1); }",
		"function isString(value: unknown): value is string { return true; } type StringOrNumber = string | number; function check(value: StringOrNumber): boolean { return isString(value); }",
		"function isString(value: unknown): value is string { return true; } function check(value: unknown): boolean { return isString(value as string | number); }",
		"function isString(value: unknown): value is string { return true; } declare function getValue(): string | number; function check(): boolean { return isString(getValue()); }",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } declare function read(): string | number; const v: string | number = read(); isString(v);",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } function read(): string | number { return 1; } isString(read());",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } declare const raw: any; isString(raw as string | number);",
		"type Circle = { kind: 'c' }; type Square = { kind: 's' }; type Shape = Circle | Square; function isCircle(value: unknown): value is Circle { return true; } function f(shape: Shape) { return isCircle(shape); }",
		"interface Animal { name: string } interface Dog extends Animal { bark(): void } function isDog(value: unknown): value is Dog { return true; } function f(animal: Animal) { return isDog(animal); }",
		"import type { Node, Identifier } from './ast'; function isIdentifier(value: unknown): value is Identifier { return true; } function f(node: Node) { return isIdentifier(node); }",
		"import type * as ESTree from './ast'; function isIdentifier(value: unknown): value is ESTree.Identifier { return true; } function f(node: ESTree.Node) { return isIdentifier(node); }",
		"type User = { readonly id: string }; function isUser(value: unknown): value is User { return true; } function f(input: object) { return isUser(input); }",
		"type Email = string & { readonly brand: 'Email' }; function isEmail(value: unknown): value is Email { return true; } function f(input: string) { return isEmail(input); }",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } function f(input: string | undefined) { return isString(input); }",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } function f(input?: string) { return isString(input); }",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } function f(input: string | number | null) { return isString(input!); }",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } type Maybe<T> = T | null; function f(input: Maybe<string>) { return isString(input); }",
		"class HttpError extends Error { status = 500; } function isHttpError(value: unknown): value is HttpError { return true; } function f(error: Error) { return isHttpError(error); }",
		"function isTrue(value: unknown): value is true { return true; } function f(flag: boolean) { return isTrue(flag); }",
		"function isA(value: unknown): value is 'a' { return true; } function f(input: string) { return isA(input); }",
		"function isType<T>(value: unknown): value is T { return true; } function f<T>(input: T) { return isType(input); }",
		"function assertDefined(value: unknown): asserts value { if (value == null) throw new Error(); } function f(input: string) { assertDefined(input); }",
	],
	invalid: [
		{ code: `${prelude} const holder = class Record {}; const commands: Record<string, Command> = { start: startCommand };`, errors: [error] },
		{ code: `${prelude} type Key<T> = T; const commands: Record<Key<string>, Command> = { start: startCommand };`, errors: [error] },
		{ code: `${prelude} const commands: Record<any, Command> = { start: startCommand };`, errors: [error] },
		{ code: `${prelude} type Key<T = string> = T; const commands: Record<Key, Command> = { start: startCommand };`, errors: [error] },
		{ code: `${prelude} type Key<T> = T; type Outer<T> = Key<T>; const commands: Record<Outer<string>, Command> = { start: startCommand };`, errors: [error] },
		{ code: "const value: unknown = {};", errors: [error] },
		{ code: "const value: object = {};", errors: [error] },
		{ code: "let value: unknown; value = {};", errors: [error] },
		{ code: "function create(): unknown { return {}; }", errors: [error] },
		{
			code: `${prelude} const commands: Record<string, Command> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} const commands: { [key: string]: Command } = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} const commands: { [K in string]: Command } = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} const commands: { start: Command } = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} const commands = { start: startCommand } as Record<string, Command>;`,
			errors: [error],
		},
		{
			code: `${prelude} const commands = ({ start: startCommand } as Record<string, Command>) as object;`,
			errors: 1,
		},
		{
			code: `${prelude} class Registry { commands: Record<string, Command> = { start: startCommand }; }`,
			errors: [error],
		},
		{
			code: `${prelude} let commands: Record<string, Command>; commands = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} function create(): Record<string, Command> { return { start: startCommand }; }`,
			errors: [error],
		},
		{
			code: `${prelude} function create(): { start: Command } { return { start: startCommand }; }`,
			errors: [error],
		},
		{
			code: `${prelude} const source = { start: startCommand }; const commands: Record<string, Command> = source;`,
			errors: [error],
		},
		{
			code: `${prelude} type Open = Record<string, Command>; const source = { start: startCommand }; const commands: Open = source;`,
			errors: [error],
		},
		{
			code: `${prelude} type Open = { [key: string]: Command }; const source = { start: startCommand }; const commands: Open = source;`,
			errors: [error],
		},
		{
			code: `${prelude} type Open = { [key in string]: Command }; const source = { start: startCommand }; const commands: Open = source;`,
			errors: [error],
		},
		{
			code: `${prelude} type Open = Readonly<Record<string, Command>>; const source = { start: startCommand }; const commands: Open = source;`,
			errors: [error],
		},
		{
			code: `${prelude} function outer() { type Open = Record<string, Command>; const commands: Open = { start: startCommand }; }`,
			errors: [error],
		},
		{
			code: `${prelude} type Index<T> = Record<string, T>; const commands: Index<Command> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Identity<T> = T; const commands: Identity<Record<string, Command>> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Index<T> = Record<string, T>; type CommandsByName = Index<Command>; const commands: CommandsByName = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Index<T = Command> = Record<string, T>; const commands: Index = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Key = string; const commands: Record<Key, Command> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} const commands: Record<PropertyKey, Command> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} const commands: Record<string | 'start', Command> = { start: startCommand };`,
			errors: [error],
		},
		{ code: "const value: unknown = 1;", errors: [error] },
		{ code: "const value: object = [];", errors: [error] },
		{
			code: 'type Pair<T, U extends PropertyKey> = Record<U, T>; type Outer<T extends PropertyKey, U extends PropertyKey> = Pair<U, T>; const openKey: Outer<string, "a"> = { x: "a" };',
			errors: [error],
		},
		{
			code: `${prelude} type K = string; type Dict<V> = Record<K, V>; type Outer<K> = Dict<K>; const commands: Outer<Command> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Second<T, U> = U; type Outer<T, U> = Record<Second<U, T>, Command>; const commands: Outer<string, "start"> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Key<T> = T; type Outer<T> = Record<Key<"a" | T>, Command>; const commands: Outer<string> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: `${prelude} type Key<T> = T; type Outer<Key> = Record<Key, Command>; const commands: Outer<Key<string>> = { start: startCommand };`,
			errors: [error],
		},
		{
			code: "function isString(value: unknown): value is string { return true; } isString('known');",
			errors: [error],
		},
		{
			code: "function isString(value: unknown): value is string { return true; } const known = 'known'; isString(known);",
			errors: [error],
		},
		{
			code: "function isString(value: string | unknown): value is string { return true; } isString('known');",
			errors: [error],
		},
		{
			code: "function isString(value: unknown): value is string { return true; } function check(known: string): boolean { return isString(known); }",
			errors: [error],
		},
		{
			code: "const isString = (value: unknown): value is string => true; const known: string = getValue(); isString(known);",
			errors: [error],
		},
		{
			code: "type User = { readonly id: string }; function isUser(value: unknown): value is User { return true; } function parse(): User { return { id: 'known' }; } const user = parse(); isUser(user);",
			errors: [error],
		},
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } function f(input: string | null) { return isString(input!); }", errors: [error] },
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } function f(input?: string) { return isString(input!); }", errors: [error] },
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } type Dir = 'up' | 'down'; function f(direction: Dir) { return isString(direction); }", errors: [error] },
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } isString('a' as 'a' | 'b');", errors: [error] },
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } function f(input: `x${string}` | 'y') { return isString(input); }", errors: [error] },
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } type Name = string; function f(name: Name) { return isString(name); }", errors: [error] },
		{ code: "type User = { readonly id: string }; function isUser(value: unknown): value is User { return true; } function f(user: User) { return isUser(user); }", errors: [error] },
		{ code: "type User = { readonly id: string }; function isUser(value: unknown): value is (User) { return true; } function f(user: User) { return isUser(user); }", errors: [error] },
		{ code: "function isTrue(value: unknown): value is boolean { return true; } function f(flag: true) { return isTrue(flag); }", errors: [error] },
		{ code: "function assertDefined(value: unknown): asserts value { if (value == null) throw new Error(); } assertDefined('known');", errors: [error] },
	],
});
