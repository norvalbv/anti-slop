import { RuleTester } from "oxlint/plugins-dev";

import { noObjectParametersRule } from "./no-object-parameters.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "objectParameter" };

// Each level doubles the work of a resolver that re-expands a repeated argument.
const nested = (wrapper: string, depth: number, inner: string): string =>
	Array.from({ length: depth }).reduce<string>((type) => `${wrapper}<${type}>`, inner);
// `A{k}<T>` instantiates `A0` 2^k times, so only an expansion budget bounds it.
const selfComposed = (depth: number): string =>
	Array.from({ length: depth }, (_, k) => `type A${k + 1}<T> = A${k}<A${k}<T>>;`).join(" ");

tester.run("anti-slop/no-object-parameters", noObjectParametersRule, {
	valid: [
		"type T = User; type Body = T; type Outer<T> = Body; function save(value: Outer<object>) {}",
		"type Alias = object;",
		"function f(value: Alias) {}",
		"interface Owner { readonly id: string } function f(value: Owner) {}",
		"function f<Value>(value: Value) {}",
		"function f<Value extends object>(value: Value) {}",
		"function f<Value extends Owner, Owner extends { readonly id: string }>(value: Value) {}",
		"type Owner = { readonly id: string }; function f<Value extends Owner>(value: Value) {}",
		"type Alias = object; function consume<Alias>(value: Alias) {}",
		"type Alias = object; type Consumer<Alias> = (value: Alias) => void;",
		"type Alias = object; interface Consumer<Alias> { consume(value: Alias): void }",
		"type Key = object; type Mapped<Input> = { [Key in keyof Input]: (value: Key) => void };",
		"type Item = object; type Unpacked<Input> = Input extends Promise<infer Item> ? (value: Item) => void : never;",
		"type Payload = object; function outer() { type Payload = { readonly id: string }; function consume(value: Payload) {} }",
		"type Identity<T> = T; function consume<Identity>(value: Identity) {}",
		"function one() { type Payload = object; } function two() { function consume(value: Payload) {} }",
		`type Two<T> = T | T; function consume(value: ${nested("Two", 30, "string")}) {}`,
		`type A0<T> = T | T; ${selfComposed(30)} function consume(value: A30<string>) {}`,
	],
	invalid: [
		{
			code: `type Two<T> = T | T; type Id<T> = T; function consume(value: ${nested("Two", 30, "string")} | Id<object>) {}`,
			errors: [error],
		},
		{ code: "type Id<T> = T; function consume(value: Id<Id<object>>) {}", errors: [error] },
		{ code: "function f(value: object) {}", errors: [error] },
		{ code: "type Alias = object; function f(value: Alias) {}", errors: [error] },
		{ code: "type Alias = (object); function f(value: Alias) {}", errors: [error] },
		{
			code: "type Item = object; type Fallback<Input> = Input extends infer Item ? string : (value: Item) => void;",
			errors: [error],
		},
		{
			code: "function consume(value: object = {}): void {}",
			errors: [{ ...error, data: { parameter: "value" } }],
		},
		{
			code: "function consume({ value }: object = {}): void {}",
			errors: [{ ...error, data: { parameter: "{ value }" } }],
		},
		{
			code: "type Bag = object; function consume({ value }: Bag): void {}",
			errors: [{ ...error, data: { parameter: "{ value }" } }],
		},
		{
			code: "function outer() { type Payload = object; function consume(value: Payload) {} }",
			errors: [error],
		},
		{
			code: "function outer() { function consume(value: Payload) {} type Payload = object; }",
			errors: [error],
		},
		{
			code: "type Identity<T> = T; function consume(value: Identity<object>) {}",
			errors: [error],
		},
		{
			code: "type Identity<T> = T; type Wrapped<T> = Identity<T>; function consume(value: Wrapped<object>) {}",
			errors: [error],
		},
	],
});
