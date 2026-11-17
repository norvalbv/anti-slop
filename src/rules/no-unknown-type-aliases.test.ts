import { RuleTester } from "oxlint/plugins-dev";

import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "unknownAlias" };

// Each level doubles the work of a resolver that re-expands a repeated argument.
const nested = (wrapper: string, depth: number, inner: string): string =>
	Array.from({ length: depth }).reduce<string>((type) => `${wrapper}<${type}>`, inner);
// `A{k}<T>` instantiates `A0` 2^k times, so only an expansion budget bounds it.
const selfComposed = (depth: number): string =>
	Array.from({ length: depth }, (_, k) => `type A${k + 1}<T> = A${k}<A${k}<T>>;`).join(" ");

tester.run("anti-slop/no-unknown-type-aliases", noUnknownTypeAliasesRule, {
	valid: [
		"type T = User; type Body = T; type Outer<T> = Body; type Value = Outer<unknown>;",
		"type User = { readonly id: string };",
		"type Alias = string; type UserId = Alias;",
		"type Payload = string | number;",
		"type Box<T> = { readonly value: T }; type Payload = Box<unknown>;",
		// Genuinely recursive aliases terminate without a finding.
		"type Loop<T> = Loop<T>; type Payload = Loop<string>;",
		"type Nested<T> = T | Nested<Nested<T>>; type Payload = Nested<string>;",
		"type Tree<T> = { readonly value: T; readonly children: Tree<T>[] }; type Forest = Tree<unknown>;",
		"type Maybe<T> = T | undefined; type Payload = Maybe<Maybe<string>>;",
		`type Two<T> = T | T; type Payload = ${nested("Two", 30, "string")};`,
		`type A0<T> = T | T; ${selfComposed(30)} type Payload = A30<string>;`,
	],
	invalid: [
		{
			code: `type Two<T> = T | T; type Id<T> = T; type Payload = ${nested("Two", 30, "string")} | Id<unknown>;`,
			errors: [error],
		},
		{ code: "type Alias = unknown;", errors: [error] },
		{ code: "type Current = unknown;", errors: [error] },
		{ code: "type UnknownValue = unknown; type Alias = UnknownValue;", errors: [error, error] },
		{ code: "type Payload = string | unknown;", errors: [error] },
		{
			code: "type Payload = string | unknown; type NestedPayload = number | Payload;",
			errors: [error, error],
		},
		{
			code: "type Identity<T> = T; type Payload = Identity<unknown>;",
			errors: [error],
		},
		{
			code: "type Identity<T> = T; type Wrapped<T> = Identity<T>; type Payload = Wrapped<unknown>;",
			errors: [error],
		},
		{
			code: "type Maybe<T> = T | undefined; type Hidden = Maybe<Maybe<unknown>>;",
			errors: [error],
		},
		{
			code: "type Identity<T> = T; type Payload = Identity<Identity<Identity<unknown>>>;",
			errors: [error],
		},
		{
			code: "type Pair<A, B> = A | B; type Payload = Pair<string, Pair<number, unknown>>;",
			errors: [error],
		},
		{
			code: "function outer() { type Payload = unknown; }",
			errors: [error],
		},
	],
});
