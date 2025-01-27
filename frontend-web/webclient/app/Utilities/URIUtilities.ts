import {History} from "history";

export interface RouterLocationProps {
    history: History;
    location: {
        search: string;
    };
}

export const getQueryParam = (
    props: RouterLocationProps | string,
    key: string
): string | null => {
    const search = typeof props === "object" ? props.location.search : props;
    const parsed = new URLSearchParams(search);
    return parsed.get(key);
};

export const getQueryParamOrElse = (
    props: RouterLocationProps | string,
    key: string,
    defaultValue: string
): string => {
    const result = getQueryParam(props, key);
    return result ? result : defaultValue;
};

export const buildQueryString = <T>(path: string, params: T): string => {
    const builtParams = Object.entries(params).map(
        pair => {
            const [key, val] = pair;
            if (val === undefined) return "";

            // normalize val to always an array
            const arr = (val instanceof Array) ? val : [val];
            // encode key only once
            const encodedKey = encodeURIComponent(key);
            // then make a different query string for each val member
            return arr.map(
                member => `${encodedKey}=${encodeURIComponent(member)}`
            ).join("&");
        }
    ).filter(it => it !== "").join("&");

    return path + "?" + builtParams;
};
