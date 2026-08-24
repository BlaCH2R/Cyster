// Synthetic test: target_id merge semantics + toCompiled/fromCompiled roundtrip.
const path = require("path");
const SB = require(path.join(__dirname, "..", "app", "src", "engine", "storyboard.js"));

const storyboard = {
  sprites: [
    { id: "base", path: "a.png", time: 0, x: 10, y: 20, scale_x: 1, scale_y: 1, opacity: 1,
      states: [{ time: 10, x: 110, scale_x: 2 }] },
    { id: "ctl", target_id: "base", path: "b.png", time: 0, scale_x: 3, opacity: 0.5,
      states: [{ time: 10, scale_y: 4, rot_z: 30 }] },
    { id: "child", parent_id: "ctl", path: "c.png", time: 0, y: 50, opacity: 1,
      states: [] }
  ]
};

const compiler = new SB.StoryboardCompiler(storyboard, null);
const internal = compiler.compile();
console.log("internal ctl parentId:", internal.sprites.find((s) => s.id === "ctl").parentId === null ? "null" : "?");
console.log("internal ctl targetId:", internal.sprites.find((s) => s.id === "ctl").targetId);
console.log("internal child parentId:", internal.sprites.find((s) => s.id === "child").parentId);

const res = SB.evaluateStoryboard(internal, 5);
console.log("evaluated sprites:", res.sprites.map((r) => `${r.obj.id}(path=${r.from.path},sx=${r.from.scale_x},sy=${r.from.scale_y},o=${r.from.opacity})`).join(", "));

// Roundtrip: internal -> compiled -> editable -> internal
const compiled = SB.toCompiled(storyboard, null);
const ctl = compiled.sprites.find((s) => s.Id === "ctl");
const child = compiled.sprites.find((s) => s.Id === "child");
console.log("compiled ctl TargetId:", ctl.TargetId, "| child ParentId:", child.ParentId);
const editable = SB.fromCompiled(compiled);
const e2 = new SB.StoryboardCompiler(editable, null).compile();
const ctl2 = e2.sprites.find((s) => s.id === "ctl");
const child2 = e2.sprites.find((s) => s.id === "child");
console.log("roundtrip ctl targetId:", ctl2.targetId, "| child parentId:", child2.parentId);

const res2 = SB.evaluateStoryboard(e2, 5);
console.log("roundtrip evaluated:", res2.sprites.map((r) => `${r.obj.id}(path=${r.from.path},sx=${r.from.scale_x},sy=${r.from.scale_y},o=${r.from.opacity})`).join(", "));

// Destroy propagation: destroying the controller destroys the target.
const storyboard2 = {
  sprites: [
    { id: "base2", path: "a.png", time: 0, opacity: 1, states: [{ time: 10, destroy: true }] },
    { id: "ctl2", target_id: "base2", path: "b.png", time: 0, states: [{ time: 10, destroy: true }] },
    { id: "kid2", parent_id: "ctl2", path: "c.png", time: 0, opacity: 1, states: [] }
  ]
};
const i2 = new SB.StoryboardCompiler(storyboard2, null).compile();
const r2 = SB.evaluateStoryboard(i2, 10);
console.log("destroy at t=10 -> destroyed:", [...r2.destroyed].join(","), "| sprites:", r2.sprites.map((x) => x.obj.id).join(","));
