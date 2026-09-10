import tseslint from "typescript-eslint";
// Prettier preserves blank lines but does not require spacing between declarations.
const functionSpacing = {
  meta: {
    type: "layout",
    fixable: "whitespace",
    schema: [],
    messages: {
      gap: "Separate top-level function declarations with a blank line.",
    },
  },
  create(context) {
    const source = context.sourceCode;
    const isFunction = (statement) => {
      const node = statement.declaration ?? statement;
      return (
        node.type === "FunctionDeclaration" ||
        (node.type === "VariableDeclaration" &&
          node.declarations.some((d) =>
            ["ArrowFunctionExpression", "FunctionExpression"].includes(
              d.init?.type,
            ),
          ))
      );
    };
    return {
      Program(program) {
        for (let index = 1; index < program.body.length; index++) {
          const previous = program.body[index - 1];
          const next = program.body[index];
          if (!(isFunction(previous) || isFunction(next))) continue;
          if (
            !/\n[ \t]*\n/.test(
              source.text.slice(previous.range[1], next.range[0]),
            )
          ) {
            context.report({
              node: next,
              messageId: "gap",
              fix: (fixer) => fixer.insertTextAfter(previous, "\n"),
            });
          }
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "function-spacing": functionSpacing } } },
    rules: {
      "local/function-spacing": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
