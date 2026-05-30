#!/usr/bin/env node

import { createServer } from "node:http";
import { handleDocsViewerRequest } from "../server/handler.mjs";

const port = Number(process.env.PORT || process.argv[2] || 8787);
const server = createServer(handleDocsViewerRequest);

server.listen(port, "::", () => {
  console.log(`Docs viewer dev server: http://127.0.0.1:${port}`);
});
