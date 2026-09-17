import fs from "fs";
import path from "path";

const dir = "scripts";
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith(".mjs")) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, "utf8");
    let changed = false;

    if (content.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")) {
      content = content.replace(/const SERVICE_ROLE_KEY = "[^"]+";/g, 'const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";');
      content = content.replace(/const targetKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || "";]+;/g, 'const targetKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || "";');
      content = content.replace(/const sourceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || "";]+;/g, 'const sourceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || "";');
      content = content.replace(/const ANON_KEY = "eyJhbGci[^"]+";/g, 'const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(fullPath, content, "utf8");
      console.log("Sanitized:", file);
    }
  }
}
