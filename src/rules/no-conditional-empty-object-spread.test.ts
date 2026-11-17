import { RuleTester } from "oxlint/plugins-dev";

import { noConditionalEmptyObjectSpreadRule } from "./no-conditional-empty-object-spread.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "avoid" };

if (noConditionalEmptyObjectSpreadRule.meta?.fixable !== undefined) {
  throw new Error("The rule must not offer an unsafe semantics-changing fix.");
}

tester.run(
  "anti-slop/no-conditional-empty-object-spread",
  noConditionalEmptyObjectSpreadRule,
  {
    valid: [
      "const result = { value };",
      "const result = { ...values };",
      "const result = condition ? { value } : {};",
      "const r = { ...(c ? { v } : ({ w } as Partial<T>)) };",
      "const r = { ...(c ? { v } : ({ w } satisfies Partial<T>)) };",
      "const r = { ...(c ? { v } : <Partial<T>>{ w }) };",
      "const r = { ...(x as Partial<T>) };",
      "const r = { ...(x as {}) };",
      "const r = { ...({} as Partial<T>) };",
      "const r = c ? { v } : ({} as Partial<T>);",
      "const r = [...(c ? [v] : ([] as T[]))];",
      "const r = [...(c ? [v] : ({} as T[]))];",
      "const r = { ...(c ? { v } : (({} as Partial<T>).x as Partial<T>)) };",
    ],
    invalid: [
      {
        code: "const result = { ...(value !== undefined ? { value } : {}) };",
        errors: [error],
      },
      {
        code: "const result = { ...(condition ? {} : { value }) };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? { v } : ({} as Partial<T>)) };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? { v } : {} satisfies Partial<T>) };",
        errors: [error],
      },
      {
        code: "const r = { ...((c ? { v } : {}) as Partial<T>) };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? { v } : {})! };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? ({} as Partial<T>) : { v }) };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? { v } : <Partial<T>>{}) };",
        errors: [error],
      },
      {
        code: "const r = { ...((c ? { v } : {}) satisfies Partial<T>) };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? { v } : ({})) };",
        errors: [error],
      },
      {
        code: "const r = { ...(c ? ({}) : { v }) };",
        errors: [error],
      },
    ],
  },
);
