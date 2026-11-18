import { RuleTester } from "oxlint/plugins-dev";

import { noWidenThenAssertRule } from "./no-widen-then-assert.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "widenThenAssert" };

tester.run("anti-slop/no-widen-then-assert", noWidenThenAssertRule, {
	valid: [
		"const source = { id: 'first' }; const widened: unknown = source;",
		"declare const input: unknown; const parsed = input as { readonly id: string };",
		// A local type named like a global utility is a user type, not a widening annotation.
		"type Record<K, V> = { id: number }; const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
		"interface Record<K, V> { id: number } const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
		"type Readonly<T> = { id: number }; const value: Readonly<Record<string, unknown>> = { id: 1 }; const result = value as { id: number };",
		"type PropertyKey = 'id'; const value: Record<PropertyKey, unknown> = { id: 1 }; const result = value as { id: number };",
		"function g() { type Record<K, V> = { id: number }; const value: Record<string, unknown> = { id: 1 }; return value as { id: number }; }",
		"import type { Record } from './types'; const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
		"import { type Record } from './types'; const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
		// A named or default import may bring a type of that name, so it shadows the built-in.
		"import { Record } from 'effect'; const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
		"import { Record } from 'effect'; const source = { id: 1 }; const value: Record<string, unknown> = source; const result = value as Record<string, number>;",
		"import Record from './rec'; const source = { id: 1 }; const value: Record<string, unknown> = source; const result = value as Record<string, number>;",
		// A namespace import named Record cannot be a type, so the global Record stays in place.
		"import { Record } from 'effect'; declare function parse(): Record<string, unknown>; const source: Record<string, unknown> = parse(); const value: unknown = source; const result = value as { id: number };",
		"import * as Record from './rec'; declare function parse(): Record<string, unknown>; const source: Record<string, unknown> = parse(); const value: unknown = source; const result = value as { id: number };",
		"function h<PropertyKey extends 'id'>() { const value: Record<PropertyKey, unknown> = { id: 1 }; return value as { id: number }; }",
		"const source = { id: 1 }; const value: Record<string, unknown> = source; { type Record<K, V> = unknown; const result = value as Record<string, number>; }",
		"const source = { id: 1 }; const value: Record<string, unknown> = source; { type Readonly<T> = unknown; const result = value as Readonly<Record<string, number>>; }",
	],
	invalid: [
		{
			code: "const source = { id: 'second' }; const widened: unknown = source; const parsed = widened as { readonly id: string };",
			errors: [error],
		},
		// Global utility types stay eligible.
		{
			code: "const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
			errors: [error],
		},
		{
			code: "const value: Readonly<Record<string, unknown>> = { id: 1 }; const result = value as { id: number };",
			errors: [error],
		},
		{
			code: "const value: Record<PropertyKey, unknown> = { id: 1 }; const result = value as { id: number };",
			errors: [error],
		},
		{
			code: "const source = { id: 1 }; const value: Record<string, unknown> = source; const result = value as Record<string, number>;",
			errors: [error],
		},
		{
			code: "const source = { id: 1 }; const value: Record<string, unknown> = source; const result = value as Readonly<Record<string, number>>;",
			errors: [error],
		},
		{
			code: "function f() { type Record<K, V> = { id: number }; } const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
			errors: [error],
		},
		{
			code: "const Record = 1; const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
			errors: [error],
		},
		{
			code: "import * as Record from './rec'; const value: Record<string, unknown> = { id: 1 }; const result = value as { id: number };",
			errors: [error],
		},
		// A local Record is evidence, and asserting to it is a narrowing.
		{
			code: "type Record<K, V> = { id: number }; const source: Record<string, unknown> = { id: 1 }; const value: unknown = source; const result = value as { id: number };",
			errors: [error],
		},
		{
			code: "const value: unknown = { id: 1 }; { type Record<K, V> = { id: V }; const result = value as Record<string, unknown>; }",
			errors: [error],
		},
	],
});
