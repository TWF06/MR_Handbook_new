import { auth, defineMcp } from "@lovable.dev/mcp-js";

import createDocumentTool from "./tools/create-document";
import createSectionTool from "./tools/create-section";
import deleteDocumentTool from "./tools/delete-document";
import getDocumentTool from "./tools/get-document";
import listDocumentsTool from "./tools/list-documents";
import listLibrariesTool from "./tools/list-libraries";
import listSectionsTool from "./tools/list-sections";
import updateDocumentTool from "./tools/update-document";
import updateSectionTool from "./tools/update-section";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "mr-handbook",
  title: "MR Handbook",
  version: "0.1.0",
  instructions:
    "Read and maintain MR Handbook content: libraries (document trees), sections and Markdown documents. Call list_libraries and list_sections first to find ids, then list_documents or get_document to read. Writes act as the signed-in staff member and respect that person's permissions; every change is written to the audit log.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listLibrariesTool,
    listSectionsTool,
    listDocumentsTool,
    getDocumentTool,
    createDocumentTool,
    updateDocumentTool,
    deleteDocumentTool,
    createSectionTool,
    updateSectionTool,
  ],
});
