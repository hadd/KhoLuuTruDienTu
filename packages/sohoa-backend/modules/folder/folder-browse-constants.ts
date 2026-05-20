export const FolderBrowseNodeType = {
    FOLDER: "folder",
    DOSSIER: "dossier",
    FILE: "file",
} as const;

export type FolderBrowseNodeType =
    (typeof FolderBrowseNodeType)[keyof typeof FolderBrowseNodeType];
