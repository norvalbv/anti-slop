import { RuleTester } from "oxlint/plugins-dev";

import { requireReadableSpacingRule } from "./require-readable-spacing.ts";
import createPaddingLineRule from "../vendor/eslint-stylistic/padding-line-between-statements.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "expectedBlankLine" };

tester.run("anti-slop/require-readable-spacing", requireReadableSpacingRule, {
  valid: [
    "function f() {};",
    "function f() {};\n\nfunction g() {}",
    "namespace Types {\nexport interface A {}\n\nexport interface B {}\n}",
    "declare module 'x' {\n  export interface A { a: string }\n  export type B = string;\n}",
    "declare namespace Types {\n  namespace Inner {\n    export interface A {}\n    export interface B {}\n  }\n}",
    "declare global {\n  export interface A {}\n  export interface B {}\n}",
    { code: "export namespace Types {\n  export interface A {}\n  export interface B {}\n}", filename: "types.d.ts" },
    "function f() {\nfirst: foo();\nsecond: bar();\n}",
    "export declare function parse(value: string): string;\nexport function parse(value: string) { return value; }",
    "declare function parse(value: string): string;\ndeclare function render(): void;",
    "export declare function parse(value: string): string;\nexport declare function render(): void;",
    "export default function (value: string): string;\nexport default function (value: string) { return value; }",
    "import { a } from 'a';\nimport { b } from 'b';\n\nexport const c = a + b;",
    "function f() {\nconst a = 1;\nconst b = 2;\n\nreturn a + b;\n}",
    "function f() { return 1; }",
    "function f(a: string): string;\nfunction f(a: number): number;\nfunction f(a: string | number) { return a; }",
    "export function f(a: string): string;\nexport function f(a: number): number;\nexport function f(a: string | number) { return a; }",
    "const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\n\nreturn a + b;\n});",
    "export type A = string;\n\n/** B documentation. */\nexport type B = number;",
    "function f() { if (ok) { go(); } else { stop(); } }",
    "function f() {\n// return docs\nreturn 1;\n}",
    "const a = 1;\n\n\nconst b = 2;",
    "switch (x) { case 1: case 2: go(); break; default: stop(); }",
    "const a = 1;\nconst b = 2;",
    "export const a = 1;\nexport const b = 2;",
    "const a = 1;\nlet b = 2;\nvar c = 3;",
    "function f() {\nconst a = 1;\nusing b = open();\n\nreturn a;\n}",
    "const a = 1;\nconst b = 2;\n\nconst c = 3;",
    "const a = 1; // trailing\nconst b = 2;",
    "/** Heads a group. */\nconst a = 1;\nconst b = 2;",
    "import { a } from 'a';\n\nconst b = a;\nexport const c = b;",
  ],
  invalid: [
    { code: "function f() {};\nfunction g() {}", output: "function f() {};\n\nfunction g() {}", errors: [error] },
    { code: "function g() {\n  if (x) {\n    y();\n  };\n  foo();\n}", output: "function g() {\n  if (x) {\n    y();\n  };\n\n  foo();\n}", errors: [error] },
    { code: "function g() {\n  function h() {};\n  foo();\n}", output: "function g() {\n  function h() {};\n\n  foo();\n}", errors: [error] },
    { code: "export declare function parse(value: string): string;\nexport function render() {}", output: "export declare function parse(value: string): string;\n\nexport function render() {}", errors: [error] },
    { code: "namespace Types {\nexport type A = string;\nexport type B = number;\n}", output: "namespace Types {\nexport type A = string;\n\nexport type B = number;\n}", errors: [error] },
    { code: "declare function parse(value: string): string;\nfunction render() {}", output: "declare function parse(value: string): string;\n\nfunction render() {}", errors: [error] },
    { code: "function parse(value: string): string;\nfunction parse(value: string) { return value; }\nfunction render(): void;\nfunction render() {}", output: "function parse(value: string): string;\nfunction parse(value: string) { return value; }\n\nfunction render(): void;\nfunction render() {}", errors: [error] },
    { code: "export default function (value: string): string;\nexport function render() {}", output: "export default function (value: string): string;\n\nexport function render() {}", errors: [error] },
    { code: "namespace Types {\nexport interface A {}\nexport interface B {}\n}", output: "namespace Types {\nexport interface A {}\n\nexport interface B {}\n}", errors: [error] },
    { code: "export namespace Types {\nexport interface A {}\nexport interface B {}\n}", output: "export namespace Types {\nexport interface A {}\n\nexport interface B {}\n}", errors: [error] },
    { code: "first: foo();\nsecond: bar();", output: "first: foo();\n\nsecond: bar();", errors: [error] },
    {
      code: "const a = 1;\n/** B docs. */\nconst b = 2;",
      output: "const a = 1;\n\n/** B docs. */\nconst b = 2;",
      errors: [error],
    },
    {
      code: "const a = 1;\n// b\nconst b = 2;",
      output: "const a = 1;\n\n// b\nconst b = 2;",
      errors: [error],
    },
    {
      code: "const a = 1;\nconst b = {\n};\nconst c = 3;",
      output: "const a = 1;\n\nconst b = {\n};\n\nconst c = 3;",
      errors: [error, error],
    },
    { code: "const a = 1;\nfoo(a);", output: "const a = 1;\n\nfoo(a);", errors: [error] },
    {
      code: "export const a = 1;\n/** B docs. */\nexport type B = number;",
      output: "export const a = 1;\n\n/** B docs. */\nexport type B = number;",
      errors: [error],
    },
    {
      code: "const a = 1; // trailing\n// leading\nconst b = 2;",
      output: "const a = 1; // trailing\n\n// leading\nconst b = 2;",
      errors: [error],
    },
    { code: "const a = 1; foo(a);", output: "const a = 1;\n\n foo(a);", errors: [error] },
    {
      code: "import { a } from 'a';\nconst b = a;",
      output: "import { a } from 'a';\n\nconst b = a;",
      errors: [error],
    },
    {
      code: "function f() {\nconst a = 1;\nreturn a;\n}",
      output: "function f() {\nconst a = 1;\n\nreturn a;\n}",
      errors: [error],
    },
    {
      code: "function f() {\nconst a = 1;\nif (a) go();\n}",
      output: "function f() {\nconst a = 1;\n\nif (a) go();\n}",
      errors: [error],
    },
    {
      code: "function f() {\nif (ok) { go(); }\nstop();\n}",
      output: "function f() {\nif (ok) { go(); }\n\nstop();\n}",
      errors: [error],
    },
    {
      code: "const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\nconst dispatch = Effect.fn('dispatch')(function* () {\nyield* a;\n});\nreturn dispatch;\n});",
      output:
        "const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\n\nconst dispatch = Effect.fn('dispatch')(function* () {\nyield* a;\n});\n\nreturn dispatch;\n});",
      errors: [error, error],
    },
    {
      code: "export interface A {}\nexport class B {}",
      output: "export interface A {}\n\nexport class B {}",
      errors: [error],
    },
    {
      code: "const a = 1\n;[1].forEach(f)",
      output: "const a = 1\n\n;[1].forEach(f)",
      errors: [error],
    },
    {
      code: "function f() {\nfoo();\nwhile (ok) go();\n}",
      output: "function f() {\nfoo();\n\nwhile (ok) go();\n}",
      errors: [error],
    },
  ],
});

// Exercise upstream options that the opinionated public rule does not enable.
tester.run(
  "vendored padding removal",
  createPaddingLineRule([{ blankLine: "never", prev: "*", next: "*" }]),
  {
    valid: ["foo();\nbar();"],
    invalid: [
      {
        code: "foo();\n\nbar();",
        output: "foo();\nbar();",
        errors: [{ messageId: "unexpectedBlankLine" }],
      },
      {
        code: "foo();\n\n// comment\n\nbar();",
        output: null,
        errors: [{ messageId: "unexpectedBlankLine" }],
      },
    ],
  },
);
