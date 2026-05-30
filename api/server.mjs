import { handleDocsViewerRequest } from "../server/handler.mjs";

export default async function handler(req, res) {
  await handleDocsViewerRequest(req, res);
}
