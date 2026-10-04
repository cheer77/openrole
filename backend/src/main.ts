import { createApp } from "./app.js";
import { config } from "./config.js";

async function main() {
  const app = await createApp();
  await app.listen(config.PORT, config.HOST);
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
