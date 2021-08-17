import * as React from "react";
import {SidebarPages, useSidebarPage} from "ui-components/Sidebar";
import {useLoading, useTitle} from "Navigation/Redux/StatusActions";
import {MainContainer} from "MainContainer/MainContainer";
import * as Heading from "ui-components/Heading";
import {useCloudAPI} from "Authentication/DataHook";
import {
    retrieveDescription,
    RetrieveDescriptionResponse
} from "Project/Grant/index";
import {emptyPage, emptyPageV2} from "DefaultObjects";
import * as Pagination from "Pagination";
import {useRefreshFunction} from "Navigation/Redux/HeaderActions";
import {Box, Card, Icon, Text} from "ui-components";
import {useHistory, useParams} from "react-router";
import {DashboardCard} from "Dashboard/Dashboard";
import styled from "styled-components";
import {GridCardGroup} from "ui-components/Grid";
import {useCallback, useEffect, useState} from "react";
import {Client} from "Authentication/HttpClientInstance";
import {AppLogo, hashF} from "Applications/Card";
import {buildQueryString} from "Utilities/URIUtilities";
import {grant, PageV2, PaginationRequestV2} from "UCloud";
import ProjectWithTitle = grant.ProjectWithTitle;

function browseProjects(request: PaginationRequestV2): APICallParameters {
    return {
        method: "GET",
        context: "",
        path: buildQueryString("/api/grant/browse-projects", request),
        parameters: request
    };
}

export const ProjectBrowser: React.FunctionComponent = () => {
    const {action} = useParams<{action: string}>();
    useTitle("Project Browser");
    useSidebarPage(SidebarPages.Projects);

    const [scrollGeneration, setScrollGeneration] = useState(0);
    const [projects, fetchProjects] = useCloudAPI<PageV2<ProjectWithTitle>>({noop: true}, emptyPageV2);

    const refresh = useCallback(() => {
        fetchProjects(browseProjects({itemsPerPage: 50}));
        setScrollGeneration(prev => prev + 1);
    }, []);

    const onLoadMore = useCallback(() => {
        fetchProjects(browseProjects({itemsPerPage: 50, next: projects.data.next}));
    }, [projects]);

    useRefreshFunction(refresh);
    useLoading(projects.loading);
    useEffect(refresh, [refresh]);

    if (action !== "new" && action !== "personal") return null;

    return <MainContainer
        header={<Heading.h3>Select an affiliation</Heading.h3>}
        main={
            <>
                <Pagination.ListV2
                    loading={projects.loading}
                    page={projects.data}
                    onLoadMore={onLoadMore}
                    infiniteScrollGeneration={scrollGeneration}
                    customEmptyPage={
                        <Text>
                            Could not find any projects for which you can apply for more resources.
                            You can contact support for more information.
                        </Text>
                    }
                    pageRenderer={() => {
                        return <>
                            <AffiliationGrid>
                                {projects.data.items.map(it => (
                                    <AffiliationLink
                                        action={action}
                                        projectId={it.projectId}
                                        title={it.title}
                                        key={it.projectId}
                                    />
                                ))}
                            </AffiliationGrid>
                        </>;
                    }}
                />
            </>
        }
    />;
};

interface LogoProps {
    projectId: string;
    size?: string;
    cacheBust?: string;
}


export const Logo: React.FunctionComponent<LogoProps> = props => {
    const [hasLoadedImage, setLoadedImage] = useState(true);
    const size = props.size !== undefined ? props.size : "40px";

    const url = Client.computeURL("/api", buildQueryString(`/grant/logo`, props));

    return (
        <>
            <img
                onErrorCapture={() => {
                    setLoadedImage(false);
                    // For some reason the state is not always correctly set. This is the worst possible work around.
                    setTimeout(() => setLoadedImage(false), 50);
                }}
                key={url}
                style={hasLoadedImage ? {width: size, height: size, objectFit: "contain"} : {display: "none"}}
                src={url}
                alt={props.projectId}
            />

            {hasLoadedImage ? null : <AppLogo size={size} hash={hashF(props.projectId)} />}
        </>
    );
};

const AffiliationLink: React.FunctionComponent<{action: string, projectId: string, title: string}> = props => {
    const history = useHistory();

    const [description,] = useCloudAPI<RetrieveDescriptionResponse>(
        retrieveDescription({
            projectId: props.projectId,
        }), {description: ""}
    );

    return <DashboardCard
        color={"purple"}
        isLoading={description.loading}
        title={<>
            <Logo projectId={props.projectId} size={"40px"} />
            <Heading.h3 ml={8}>{props.title}</Heading.h3>
        </>}
        subtitle={<Icon name="arrowDown" rotation={-90} size={18} color={"darkGray"} />}
        onClick={() => history.push(`/project/grants/${props.action}/${props.projectId}`)}
    >
        <Box pt={8} pb={16}>
            {description.data.description}
        </Box>
    </DashboardCard>;
};

const AffiliationGrid = styled(GridCardGroup)`
    & > ${Card} {
        position: relative;
        min-height: 200px;
        cursor: pointer;
        transition: transform 0.2s;
        &:hover {
            transform: scale(1.02);
        }
    }
`;

export default ProjectBrowser;
