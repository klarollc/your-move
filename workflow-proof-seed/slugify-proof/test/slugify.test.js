import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify } from "../src/slugify.js";

test("lowercases and joins words with hyphens", () => {
  assert.equal(slugify("Hello World"), "hello-world");
  assert.equal(slugify("UPPER"), "upper");
});

test("trims the ends and collapses runs of spaces", () => {
  assert.equal(slugify("  Trim   me  "), "trim-me");
});

test("collapses repeated hyphens", () => {
  assert.equal(slugify("Already--hyphenated"), "already-hyphenated");
});

test("drops punctuation and treats it as a word break", () => {
  assert.equal(slugify("Rock & Roll!"), "rock-roll");
  assert.equal(slugify("Version 2"), "version-2");
});

test("returns an empty string when nothing usable is left", () => {
  assert.equal(slugify(""), "");
  assert.equal(slugify("---"), "");
  assert.equal(slugify("!!!"), "");
});
