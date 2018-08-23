import swal from "sweetalert2";
import { SensitivityLevel } from "DefaultObjects";
import Cloud from "Authentication/lib";
import { SemanticICONS } from "semantic-ui-react";
import { SortBy, SortOrder, File, Acl, FileType } from "Files";
import { dateToString } from "Utilities/DateUtilities";
import {
    getFilenameFromPath,
    fileSizeToString,
    replaceHomeFolder
} from "Utilities/FileUtilities";

export const toLowerCaseAndCapitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();



/**
 * Returns a string based on the amount of users associated with the ACL
 * @param {Acl[]} acls - the list of access controls
 * @return {string}
 */
export const getOwnerFromAcls = (acls: Acl[]): string => {
    if (acls.length > 0) {
        return `${acls.length + 1} members`;
    } else {
        return "Only You";
    }
};

export const failureNotification = (title: string, seconds: number = 3) => swal({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: seconds * 1_000,
    type: "error",
    backdrop: false,
    title
});

export const successNotification = (title: string, seconds: number = 3) => swal({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: seconds * 1_000,
    type: "success",
    backdrop: false,
    title
});

export const infoNotification = (title: string, seconds: number = 3) => swal({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: seconds * 1_000,
    type: "info",
    backdrop: false,
    title
});

// FIXME React Semantic UI Forms doesn't seem to allow checkboxes with labels, unless browser native checkboxes
export const shareSwal = () => swal({
    title: "Share",
    input: "text",
    html: `<form class="ui form">
            <div class="three fields">
                <div class="field"><div class="ui checkbox">
                    <input id="read-swal" type="checkbox" /><label>Read</label>
                </div></div>
                <div class="field"><div class="ui checkbox">
                    <input id="write-swal" type="checkbox" /><label>Write</label>
                </div></div>
                <div class="field"><div class="ui checkbox">
                    <input id="execute-swal" type="checkbox" /><label>Execute</label>
                </div></div>
            </div>
          </form>`,
    showCloseButton: true,
    showCancelButton: true,
    inputPlaceholder: "Enter username...",
    focusConfirm: false,
    inputValidator: (value) =>
        (!value && "Username missing") ||
        !(isElementChecked("read-swal") ||
            isElementChecked("write-swal") ||
            isElementChecked("execute-swal")) && "Select at least one access right",
});

export function isElementChecked(id: string): boolean {
    return (document.getElementById(id) as HTMLInputElement).checked;
}

export const inputSwal = (inputName: string) => ({
    title: "Share",
    input: "text",
    showCloseButton: true,
    showCancelButton: true,
    inputPlaceholder: `Enter ${inputName}...`,
    focusConfirm: false,
    inputValidator: (value: string) =>
        (!value && `${toLowerCaseAndCapitalize(inputName)} missing`)
});

export function sortingColumnToValue(sortBy: SortBy, file: File): string {
    switch (sortBy) {
        case SortBy.TYPE:
            return toLowerCaseAndCapitalize(file.type);
        case SortBy.PATH:
            return getFilenameFromPath(file.path);
        case SortBy.CREATED_AT:
            return dateToString(file.createdAt);
        case SortBy.MODIFIED_AT:
            return dateToString(file.modifiedAt);
        case SortBy.SIZE:
            return fileSizeToString(file.size);
        case SortBy.ACL:
            return getOwnerFromAcls(file.acl)
        case SortBy.FAVORITED:
            return file.favorited ? "Favorited" : "";
        case SortBy.SENSITIVITY:
            return SensitivityLevel[file.sensitivityLevel];
        case SortBy.ANNOTATION:
            return file.annotations.toString();
        default:
            return "";
    }
}

export const getSortingIcon = (sortBy: SortBy, sortOrder: SortOrder, name: SortBy): SemanticICONS => {
    if (sortBy === name) {
        return sortOrder === SortOrder.DESCENDING ? "chevron down" : "chevron up";
    }
    return null;
};

export const getExtensionFromPath = (path: string) => path.split(".").pop();

export const iconFromFilePath = (filePath: string, type: FileType, homeFolder: string): SemanticICONS => {
    const homeFolderReplaced = replaceHomeFolder(filePath, homeFolder);
    if (homeFolderReplaced === "Home/Jobs/") return "tasks";
    if (homeFolderReplaced === "Home/Favorites/") return "star";
    if (type === "DIRECTORY") return "folder";
    const filename = getFilenameFromPath(filePath);
    if (!filename.includes(".")) {
        return "file outline";
    }
    const extension = getExtensionFromPath(filePath);
    switch (extension) {
        case "md":
        case "swift":
        case "kt":
        case "kts":
        case "js":
        case "jsx":
        case "ts":
        case "tsx":
        case "java":
        case "py":
        case "python":
        case "tex":
        case "r":
        case "c":
        case "cc":
        case "c++":
        case "h++":
        case "cpp":
        case "h":
        case "hh":
        case "hpp":
        case "html":
        case "sql":
        case "sh":
        case "iol":
        case "ol":
        case "col":
        case "bib":
        case "toc":
        case "jar":
        case "exe":
            return "file code outline";
        case "png":
        case "gif":
        case "tiff":
        case "eps":
        case "ppm":
        case "svg":
        case "jpg":
            return "image";
        case "txt":
        case "pdf":
        case "xml":
        case "json":
        case "csv":
        case "yml":
        case "plist":
            return "file outline";
        case "wav":
        case "mp3":
            return "volume up";
        case "gz":
        case "zip":
        case "tar":
            return "file archive outline";
        default:
            if (getFilenameFromPath(filePath).split(".").length > 1)
                console.warn(`Unhandled extension "${extension}" for file ${filePath}`);
            return "file outline";
    }
};

// TODO Remove navigation when backend support comes.
export const createProject = (filePath: string, cloud: Cloud, navigate: (path: string) => void) =>
    cloud.put("/projects", { fsRoot: filePath }).then(() => {
        redirectToProject(filePath, cloud, navigate, 5);
    }).catch(() => failureNotification(`An error occurred creating project ${filePath}`));

const redirectToProject = (path: string, cloud: Cloud, navigate: (path: string) => void, remainingTries: number) => {
    cloud.get(`/metadata/by-path?path=${path}`).then(() => navigate(path)).catch(() => {
        if (remainingTries > 0) {
            setTimeout(redirectToProject(path, cloud, navigate, remainingTries - 1), 400);
        } else {
            successNotification(`Project ${path} is being created.`)
        }
    });
};

// FIXME Less index accessing
export const inRange = (status: number, min: number, max: number): boolean => status >= min && status <= max;
export const inSuccessRange = (status: number): boolean => inRange(status, 200, 299);
export const removeTrailingSlash = (path: string) => path.endsWith("/") ? path.slice(0, path.length - 1) : path;
export const addTrailingSlash = (path: string) => path.endsWith("/") ? path : `${path}/`;
export const shortUUID = (uuid: string): string => uuid.substring(0, 8).toUpperCase();

export const blankOrNull = (value: string): boolean => value == null || value.length == 0 || /^\s*$/.test(value);

export const ifPresent = (f: any, handler: (f: any) => void) => {
    if (f) handler(f)
};

export const downloadAllowed = (files: File[]) =>
    files.length === 1 || files.every(f => f.sensitivityLevel !== "SENSITIVE")

export const prettierString = (str: string) => toLowerCaseAndCapitalize(str).replace(/_/g, " ")

export const favoriteApplication = (app) => {
    app.favorite = !app.favorite;
    if (app.favorite) {
        // post
    } else {
        // delete
    }
    return app;
}

export function defaultErrorHandler(error: { request: XMLHttpRequest, response: any }): number {
    let request: XMLHttpRequest = error.request;
    let why: string = null;

    if (!!error.response && !!error.response.why) {
        why = error.response.why;
    }

    if (!!request) {
        if (!why) {
            switch (request.status) {
                case 400:
                    why = "Bad request";
                    break;
                case 403:
                    why = "Permission denied";
                    break;
                default:
                    why = "Internal Server Error. Try again later.";
                    break;
            }
        }

        failureNotification(why);
        return request.status;
    }
    return 500;
}