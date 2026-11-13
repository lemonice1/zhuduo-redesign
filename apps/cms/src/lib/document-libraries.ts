export const documentLibraryTypes = ["technical-documents-housing", "technical-documents-electrical"] as const;
export const documentLibraryFields = ["title", "summary"];
export const documentLibraryAdminFields = [...documentLibraryFields, "documents", "documents.title", "documents.description", "documents.file"];
