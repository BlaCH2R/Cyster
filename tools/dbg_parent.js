// Debug: trace parent_id through fromCompiled -> compile() -> internal entries.
const fs = require("fs");
const path = require("path");
const SB = require(path.join(__dirname, "..", "app", "src", "engine", "storyboard.js"));

const DIR = "V:/cytoid storyboarder/项目/测试：delusion/Delusion";
const raw = JSON.parse(fs.readFileSync(path.join(DIR, "storyboard_compiled.json"), "utf8"));
const editable = SB.fromCompiled(raw);
const titleY = editable.sprites.find((s) => s.id === "title_y");
const rotdad = editable.sprites.find((s) => s.id === "rotdad");
console.log("editable title_y keys:", Object.keys(titleY).slice(0, 20).join(","));
console.log("editable title_y parent_id:", titleY.parent_id, "| target_id:", titleY.target_id);
console.log("editable rotdad parent_id:", rotdad.parent_id, "| target_id:", rotdad.target_id);
console.log("editable sprites with parent_id:", editable.sprites.filter((s) => s.parent_id).length);
console.log("editable sprites with target_id:", editable.sprites.filter((s) => s.target_id).length);

const compiler = new SB.StoryboardCompiler(editable, null);
const internal = compiler.compile();
const t2 = internal.sprites.find((s) => s.id === "title_y");
const r2 = internal.sprites.find((s) => s.id === "rotdad");
console.log("internal title_y parentId:", t2 && t2.parentId, "| targetId:", t2 && t2.targetId);
console.log("internal rotdad parentId:", r2 && r2.parentId, "| targetId:", r2 && r2.targetId);
console.log("internal sprites with parentId:", internal.sprites.filter((s) => s.parentId).length);
console.log("internal sprites with targetId:", internal.sprites.filter((s) => s.targetId).length);
