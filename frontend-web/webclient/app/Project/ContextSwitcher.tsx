import {emptyPage} from "@/DefaultObjects";
import * as React from "react";
import {connect} from "react-redux";
import {shortUUID, stopPropagationAndPreventDefault} from "@/UtilityFunctions";
import {useEffect} from "react";
import {Dispatch} from "redux";
import {dispatchSetProjectAction, getStoredProject} from "@/Project/Redux";
import {Flex, Truncate, Text, Icon, Divider} from "@/ui-components";
import ClickableDropdown from "@/ui-components/ClickableDropdown";
import styled from "styled-components";
import {useCloudAPI} from "@/Authentication/DataHook";
import {UserInProject, ListProjectsRequest, listProjects} from "@/Project";
import {useHistory} from "react-router";
import {History} from "history";
import {useProjectStatus} from "@/Project/cache";
import {initializeResources} from "@/Services/ResourceInit";

// eslint-disable-next-line no-underscore-dangle
function _ContextSwitcher(props: ContextSwitcherReduxProps & DispatchProps): JSX.Element | null {
    const projectStatus = useProjectStatus();
    const [response, setFetchParams, params] = useCloudAPI<Page<UserInProject>, ListProjectsRequest>(
        listProjects({page: 0, itemsPerPage: 10, archived: false}),
        emptyPage
    );

    let activeContext = "My Workspace";
    if (props.activeProject) {
        const membership = projectStatus.fetch().membership.find(it => it.projectId === props.activeProject);
        if (membership) {
            activeContext = membership.title;
        } else {
            activeContext = shortUUID(props.activeProject);
        }
    }

    useEffect(() => {
        const storedProject = getStoredProject();
        props.setProject(storedProject ?? undefined);
    }, []);

    const history = useHistory();

    return (
        <Flex pr="12px" alignItems={"center"} data-component={"project-switcher"}>
            <ClickableDropdown
                trigger={
                    <HoverBox>
                        <HoverIcon
                            onClick={e => {
                                stopPropagationAndPreventDefault(e);
                                history.push("/project/dashboard");
                            }}
                            name="projects"
                            color2="midGray"
                            mr=".5em"
                        />
                        <Truncate width={"150px"}>{activeContext}</Truncate>
                        <Icon name={"chevronDown"} size={"12px"} ml={"4px"} />
                    </HoverBox>
                }
                colorOnHover={false}
                paddingControlledByContent
                onTriggerClick={() => (setFetchParams({...params}), projectStatus.reload())}
                left="0px"
                width="250px"
            >
                <BoxForPadding>
                    {props.activeProject ?
                        (
                            <Text onClick={() => onProjectUpdated(history, () => props.setProject(), props.refresh)}>
                                My Workspace
                            </Text>
                        ) : null
                    }
                    {response.data.items.filter(it => !(it.projectId === props.activeProject)).map(project =>
                        <Text
                            key={project.projectId}
                            onClick={() => onProjectUpdated(history, () => props.setProject(project.projectId), props.refresh)}
                        >
                            <Truncate width="215px">{project.title}</Truncate>
                        </Text>
                    )}
                    {props.activeProject || response.data.items.length > 0 ? <Divider /> : null}
                    <Text onClick={() => history.push("/projects")}>Manage projects</Text>
                    <Text onClick={() => history.push("/project/dashboard")}>
                        {props.activeProject ? "Manage active project" : "Manage my workspace"}
                    </Text>
                </BoxForPadding>
            </ClickableDropdown>
        </Flex>
    );
}

const BoxForPadding = styled.div`
    & > div:hover {
        background-color: var(--lightBlue);
    }

    & > ${Divider} {
        width: 80%;
        margin-left: 26px;
    }

    & > ${Text} {
        padding-left: 10px;
    }

    margin-top: 12px;
    margin-bottom: 12px;
`;

const HoverIcon = styled(Icon)`
    &:hover {
        transform: scale(1.1);
    }
`;

function onProjectUpdated(history: History, runThisFunction: () => void, refresh?: () => void): void {
    const {pathname, search} = window.location;
    runThisFunction();
    if (pathname === "/app/files") {
        history.push("/drives")
    }
    initializeResources();
    refresh?.();
}

const HoverBox = styled.div`
    display: inline-flex;
    flex-wrap: nowrap;
    color: white;
    padding: 6px 8px;
    cursor: pointer;
    user-select: none;
    align-items: center;
    border-radius: 5px;
    &:hover {
        background-color: rgba(236, 239, 244, 0.25);
        color: white;
        transition: background-color 0.2s;
    }
`;

interface ContextSwitcherReduxProps {
    activeProject?: string;
    refresh?: () => void;
}

interface DispatchProps {
    setProject: (id?: string) => void;
}

const mapStateToProps = (state: ReduxObject): ContextSwitcherReduxProps =>
    ({activeProject: state.project.project, refresh: state.header.refresh});

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
    setProject: id => dispatchSetProjectAction(dispatch, id)
});

export const ContextSwitcher = connect(mapStateToProps, mapDispatchToProps)(_ContextSwitcher);
