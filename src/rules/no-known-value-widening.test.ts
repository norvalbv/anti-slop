import { RuleTester } from "oxlint/plugins-dev";

import { noKnownValueWideningRule } from "./no-known-value-widening.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const error = { messageId: "widening" };

const prelude = "type Command = () => void; const startCommand = () => {};";
const isStringGuard = "function isString(value: unknown): value is string { return typeof value === 'string'; }";

function unionAliasChain(depth: number): string {
	const links = Array.from({ length: depth }, (_, i) => `type A${i + 1} = (A${i}) | 'q${i + 1}';`);
	return ["type A0 = 'q0';", ...links].join(" ");
}

const aliasChain = (depth: number, alias: (level: number) => string): string =>
	Array.from({ length: depth }, (_, level) => alias(level + 1)).join(" ");
// Each alias repeats the one below it, so expanding `K30` naively takes 2^30 steps.
const doublingKeys = `type K0<T> = T; ${aliasChain(30, (k) => `type K${k}<T> = K${k - 1}<T> | K${k - 1}<T>;`)}`;
const doublingPlainKeys = `type P0 = "start"; ${aliasChain(30, (k) => `type P${k} = P${k - 1} | P${k - 1};`)}`;
// `L30<string>` holds `string` only after 2^30 literal members, past any expansion budget.
const lateBroadKeys = `type L0<T> = T; ${aliasChain(30, (k) => `type L${k}<T> = L${k - 1}<"x"> | L${k - 1}<T>;`)}`;
const selfComposed = `type A0<T> = T | T; ${aliasChain(30, (k) => `type A${k}<T> = A${k - 1}<A${k - 1}<T>>;`)}`;
const unionDag = (leaf: string): string =>
	`${isStringGuard} type T0 = ${leaf}; ${aliasChain(40, (k) => `type T${k} = T${k - 1} | T${k - 1};`)} function f(input: T40) { return isString(input); }`;
// A plain chain this deep exhausts the expansion budget, so every alias in it stays undecided.
const undecidedChain = (base: string): string =>
	`type D0 = ${base}; ${aliasChain(1500, (k) => `type D${k} = D${k - 1};`)}`;
const twoLevels = (depth: number, inner: string): string =>
	Array.from({ length: depth }).reduce<string>((type) => `Two<${type}>`, inner);

tester.run("anti-slop/no-known-value-widening", noKnownValueWideningRule, {
	valid: [
		// Whitespace inside a string literal type is its value, so " " and "" differ.
		"function isSpace(value: unknown): value is \" \" { return value === \" \"; } const e: \"\" = \"\"; isSpace(e);",
		// A named or default import may bring a type of that name, so it shadows the built-in.
		`import { Record } from "effect"; ${prelude} const commands: Record<string, Command> = { start: startCommand };`,
		// Undecided types never report, even where the fully expanded type would.
		`${undecidedChain("Record<string, unknown>")} declare const x: { id: number }; const v: unknown = x as D1500;`,
		`${undecidedChain("{ id: number }")} const a = { id: 1 } as D1500; export const b: Record<string, number> = a;`,
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
		"const a: Record<string, unknown> = {}; const b: Record<string, unknown> = a;",
		"const a: Record<string, unknown> = {}; function f(): Record<string, unknown> { return a; }",
		"const a: Record<string, number> = {}; const b: object = a;",
		"type Bag = Record<string, unknown>; const a: Bag = {}; const b: Bag = a;",
		"type Item = { id: number }; let check: (value: Item) => boolean = (value: unknown): value is Item => true; check = (value: Item) => value.id > 0; check({ id: 1 });",
		"type Item = { id: number }; let check = (value: unknown): value is Item => true; check = (value: unknown): value is Item => false; check({ id: 1 });",
		"type Item = { id: number }; let check = (value: unknown): value is Item => true; function swap() { check = (value: unknown): value is Item => false; } check({ id: 1 });",
		"function isString(value: unknown): value is string { return typeof value === 'string'; } let read = (): string => 'x'; read = (() => 1) as never; isString(read());",
		`${prelude} ${doublingKeys} const commands: Record<K30<"start">, Command> = { start: startCommand };`,
		`${prelude} ${doublingPlainKeys} const commands: Record<P30, Command> = { start: startCommand };`,
		// An undecided source annotation is neither reported nor treated as known evidence.
		`${prelude} ${lateBroadKeys} const source: Record<L30<string>, Command> = { start: startCommand }; const commands: Record<string, Command> = source;`,
		`${selfComposed} function isPayload(value: unknown): value is A30<unknown> { return true; } function check(input: A30<unknown>) { return isPayload(input); }`,
		"type Item = { readonly group: string }; function groupItems(items: readonly Item[]): Record<string, Item[]> { const out = {} as Record<string, Item[]>; for (const item of items) (out[item.group] ??= []).push(item); return out; }",
		"const a = {} as Record<string, unknown>; const b: Record<string, unknown> = a;",
		"const a = <Record<string, number>>{}; function f(): Record<string, number> { return a; }",
		"const a = ({} as Record<string, number>)!; const b: Record<string, number> = a;",
		// Sized to take minutes if every call rescans all references to its callee and its argument.
		`function helper(value: unknown): unknown { return value; } ${"helper(helper);".repeat(70000)}`,
		`function isString(value: unknown): value is string { return typeof value === "string"; } const input = load(); ${"isString(input);".repeat(70000)}`,
		"interface Item { readonly id: string } function isItem(value: unknown): value is Item { return true; } function pick<Item>(candidate: Item) { return isItem(candidate); }",
		"interface Item { readonly id: string } function isItem(value: unknown): value is Item { return true; } function local(candidate: unknown) { interface Item { readonly name: string } const typed: Item = candidate as Item; return isItem(typed); }",
		"interface Node { kind: string } function isNode(value: unknown): value is Node { return true; } function walk<Node>(n: Node) { return isNode(n); }",
		"type Item = { id: number }; function isItem(value: unknown): value is Item { return true; } function first<Item>(xs: Item[]) { const x: Item = xs[0]!; return isItem(x); }",
		"type Id = string; function isId(value: unknown): value is Id { return true; } declare function get(): string | number; function f() { type Id = string | number; const x: Id = get(); return isId(x); }",
		"type Box = { id: number }; function isBox(value: unknown): value is Array<Box> { return true; } function f<Box>(boxes: Array<Box>) { return isBox(boxes); }",
		`${isStringGuard} declare const raw: unknown; isString(raw as const);`,
		// An array or object literal is compared only with predicates every such literal satisfies.
		"function nonEmpty(value: unknown): value is [string, ...string[]] { return true; } const xs = ['a']; nonEmpty(xs);",
		"function isNames(value: unknown): value is string[] { return true; } isNames(['a']);",
		"type Item = { id: number }; function isItem(value: unknown): value is Item { return true; } isItem({ id: 'x' });",
		"function isCounts(value: unknown): value is Record<string, number> { return true; } isCounts({ a: 'x' });",
		"function isWithId(value: unknown): value is { [key: string]: unknown; id: number } { return true; } isWithId({});",
		"function isAB(value: unknown): value is Record<'a' | 'b', unknown> { return true; } isAB({});",
		"function isList(value: unknown): value is unknown[] { return true; } isList(['a'] as const);",
		"function isList(value: unknown): value is unknown[] { return true; } const xs = ['a'] as const; isList(xs);",
		"type Array<T> = { items: T[] }; function isList(value: unknown): value is Array<unknown> { return true; } isList([1]);",
		"function isRecord(value: unknown): value is Record<string, unknown> { return true; } isRecord([1]);",
		"function isType<T>(value: unknown): value is T { return true; } isType({ id: 1 });",
		// A union DAG of aliases 40 deep: exponential without a per-alias memo.
		unionDag("1"),
		`${isStringGuard} ${unionAliasChain(2000)} function f(input: A2000) { return isString(input); }`,
	],
	invalid: [
		{ code: "function isSpace(value: unknown): value is \" \" { return value === \" \"; } const e: \" \" = \" \"; isSpace(e);", errors: [error] },
		// Every leaf satisfies the guard, so the whole DAG is walked: exponential without a per-alias memo.
		{ code: unionDag('"a"'), errors: [error] },
		{ code: `${prelude} type Id<T> = T; const commands: Id<Id<Record<string, Command>>> = { start: startCommand };`, errors: [error] },
		{ code: `${prelude} type Key<Key> = Key; const commands: Record<Key<Key<string>>, Command> = { start: startCommand };`, errors: [error] },
		{ code: `${prelude} ${doublingKeys} const commands: Record<K30<"start"> | string, Command> = { start: startCommand };`, errors: [error] },
		{
			code: `${prelude} type Two<T> = T | T; type Id<T> = T; const commands: Record<${twoLevels(30, '"start"')} | Id<string>, Command> = { start: startCommand };`,
			errors: [error],
		},
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
		{ code: "const a = { x: 1 }; const b: Record<string, number> = a;", errors: [error] },
		{ code: "const a: Record<'x', number> = { x: 1 }; const b: Record<string, number> = a;", errors: [error] },
		{ code: "const a: string = 'x'; const b: unknown = a;", errors: [error] },
		{ code: "const a: object = {}; const b: object = a;", errors: [error] },
		{ code: "const a: unknown = 1; const b: unknown = a;", errors: [error] },
		{ code: "const a = {}; const b: Record<string, number> = a;", errors: [error] },
		{ code: "const a = { x: 1 } satisfies Record<string, number>; const b: Record<string, number> = a;", errors: [error] },
		{ code: "const a = { x: 1 } as const; const b: Record<string, number> = a;", errors: [error] },
		{ code: "const a = { x: 1 } as Record<string, number>; const b: Record<string, number> = a;", errors: [error] },
		{ code: "interface Item { readonly id: string } function isItem(value: unknown): value is Item { return true; } function f(item: Item) { return isItem(item); }", errors: [error] },
		{ code: "import type * as ESTree from './ast'; function isIdentifier(value: unknown): value is ESTree.Identifier { return true; } function f(node: ESTree.Identifier) { return isIdentifier(node); }", errors: [error] },
		{ code: "type Box = { id: number }; function isBoxes(value: unknown): value is Array<Box> { return true; } function f(boxes: Array<Box>) { return isBoxes(boxes); }", errors: [error] },
		{ code: "function outer() { type Id = string; function isId(value: unknown): value is Id { return true; } function f(id: Id) { return isId(id); } }", errors: [error] },
		{ code: `${isStringGuard} isString('a' as const);`, errors: [error] },
		{ code: `${isStringGuard} isString(<const>'a');`, errors: [error] },
		{ code: `${isStringGuard} type Id = "a" | "b"; function f(input: Id | Id) { return isString(input); }`, errors: [error] },
		{ code: `${isStringGuard} type Name = "x"; type Other = Name | "y"; function f(input: Name | Other) { return isString(input); }`, errors: [error] },
		{ code: `${isStringGuard} type Id = string; type A = Id; type B = Id; function f(input: A | B) { return isString(input); }`, errors: [error] },
		{ code: `${isStringGuard} ${unionAliasChain(20)} function f(input: A20) { return isString(input); }`, errors: [error] },
		{ code: `${isStringGuard} ${unionAliasChain(2000)} function f(input: A2000) { return isString(input); } const bad: unknown = {};`, errors: [error] },
		{ code: `${prelude} interface Commands { readonly start: Command } const source: Commands = { start: startCommand }; const commands: Record<string, Command> = source;`, errors: [error] },
		{ code: "type Item = { id: number }; let check = (value: unknown): value is Item => true; const item: Item = { id: 1 }; check(item);", errors: [error] },
		{ code: "type Item = { id: number }; const check = (value: unknown): value is Item => true; const item: Item = { id: 1 }; check(item);", errors: [error] },
		{ code: "function isString(value: unknown): value is string { return typeof value === 'string'; } const read = (): string => 'x'; isString(read());", errors: [error] },
		{ code: "function isObject(value: unknown): value is object { return true; } isObject({ id: 1 });", errors: [error] },
		{ code: "function isObject(value: unknown): value is object { return true; } const xs = [1]; isObject(xs);", errors: [error] },
		{ code: "function isRecord(value: unknown): value is Record<string, unknown> { return true; } isRecord({ id: 1 });", errors: [error] },
		{ code: "function isRecord(value: unknown): value is Record<PropertyKey, any> { return true; } isRecord({});", errors: [error] },
		{ code: "function isRecord(value: unknown): value is { readonly [key: string]: unknown } { return true; } isRecord({ id: 1 } as const);", errors: [error] },
		{ code: "function isList(value: unknown): value is unknown[] { return true; } isList(['a']);", errors: [error] },
		{ code: "function isList(value: unknown): value is Array<unknown> { return true; } const xs = [1]; isList(xs);", errors: [error] },
		{ code: "function isList(value: unknown): value is readonly unknown[] { return true; } isList(['a'] as const);", errors: [error] },
		{ code: "function isList(value: unknown): value is ReadonlyArray<unknown> { return true; } const xs = ['a'] as const; isList(xs);", errors: [error] },
		{ code: "type Bag = object; function isBag(value: unknown): value is Bag { return true; } isBag([1]);", errors: [error] },
	],
});
