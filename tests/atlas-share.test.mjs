import { test } from "node:test";
import assert from "node:assert/strict";
import { shareDestination } from "../site/atlas-share.mjs";

test("standalone graph links distinguish a declaration, a guided step and a reference path", () => {
  const state = { lens: "network", subview: "", selected: "riemannHypothesis" };
  assert.equal(shareDestination(state).fragment, "");
  const id = "UpperTheory.Comparison₂.core_gm";
  assert.equal(
    shareDestination({ ...state, selected: id }).fragment,
    "#map/" + encodeURIComponent(id),
  );
  assert.equal(
    shareDestination({ ...state, lens: "route", selected: "gm" }).fragment,
    "#map/step%3Agm",
  );
  assert.equal(
    shareDestination({
      ...state,
      subview: "path",
      selected: id,
      origin: "riemannHypothesis",
      position: 12,
    }).fragment,
    "#map/trail/13/riemannHypothesis",
  );
});
test("folder links carry the browsed source page across sessions", () => {
  const fragment = shareDestination({
    lens: "corpus",
    directory: "src/Lower Theory",
    offset: 65,
  }).fragment;
  assert.equal(fragment, "#map/folder/65/src/Lower%20Theory");
});
