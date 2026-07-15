#!/usr/bin/env node
// app.jsx (JSX source) を app.compiled.js (plain JS, ブラウザでそのまま実行可) に変換する。
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const SRC = path.join(__dirname, "app.jsx");
const OUT = path.join(__dirname, "app.compiled.js");

const src = fs.readFileSync(SRC, "utf8");
const { code } = babel.transform(src, {
  presets: [["@babel/preset-react", { runtime: "classic" }]],
  filename: "app.jsx",
});

fs.writeFileSync(OUT, code, "utf8");
console.log("build OK: app.compiled.js (" + code.length + " bytes)");
