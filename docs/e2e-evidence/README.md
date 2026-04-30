这个分支只放 e2e screenshot evidence，不包含任何 source。

每张图都是用本地 agent-browser CLI（agent-browser 0.25.4）驱动 Chromium
打开 fulcrum dev server (`bun --watch server/index.ts` + `bunx vite`) 截的。

PR body 会引用这里的 raw URL：

```
https://raw.githubusercontent.com/Mouriya-Emma/fulcrum/e2e-evidence/docs/e2e-evidence/<file>.png
```

文件命名 `pr-<NN>-<scenario>.<ext>`。
