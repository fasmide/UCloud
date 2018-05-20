import { Cloud } from "../../../authentication/SDUCloudObject";
import { Page } from "../../types/types";

export interface ProjectMetadata {
    /**
     * The SDUCloud FSRoot this metadata belongs to (i.e. project)
     */
    sduCloudRoot: string

    /**
     * The title of this project
     */
    title: string

    /**
     * A list of files in this project
     */
    files: FileDescriptionForMetadata[]

    /**
     * A list of creators of this project (defaults to users in project)
     */
    creators: Creator[]

    /**
     * A description of the project.
     */
    description: string

    /**
     * The license of the project
     */
    license: string

    id: string

    embargoDate?: number
    accessConditions?: string

    keywords?: string[]
    notes?: string
    contributors?: Creator[]
    references?: string[]
    grants?: Grant[]

    subjects?: Subject[]
    relatedIdentifiers?: RelatedIdentifier[]
}

export interface Grant {
    id: string
}

export interface Subject {
    term: string
    identifier: string
    scheme?: string
}

export interface RelatedIdentifier {
    relation: string
    identifier: string
}

export interface Creator {
    name?: string
    affiliation?: string
    orcId?: string
    gnd?: string
}

export interface FileDescriptionForMetadata {
    id: string
    type: string
    path: string
}

export const simpleSearch = (
    query: string,
    page: number,
    itemsPerPage: number
): Promise<Page<ProjectMetadata>> => {
    return Cloud.get(
        `/metadata/search?query=${query}` +
        `&page=${page}&itemsPerPage=${itemsPerPage}`
    ).then(f => f.response);
}

export const getById = (id: string): Promise<ProjectMetadata> => {
    return Cloud.get(`/metadata/${id}`).then(f => f.response);
}