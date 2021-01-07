import * as React from "react";
import {SyntheticEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {PRODUCT_NAME} from "../../../site.config.json";
import {useHistory, useParams} from "react-router";
import {MainContainer} from "MainContainer/MainContainer";
import {useCloudAPI, useCloudCommand} from "Authentication/DataHook";
import * as Jobs from "./index";
import {isJobStateTerminal, JobState, stateToTitle} from "./index";
import * as Heading from "ui-components/Heading";
import {SidebarPages, useSidebarPage} from "ui-components/Sidebar";
import {useTitle} from "Navigation/Redux/StatusActions";
import {joinToString, shortUUID, timestampUnixMs, useEffectSkipMount} from "UtilityFunctions";
import {AppToolLogo} from "Applications/AppToolLogo";
import styled, {keyframes} from "styled-components";
import {Box, Button, Flex, Icon, Link} from "ui-components";
import {DashboardCard} from "Dashboard/Dashboard";
import {IconName} from "ui-components/Icon";
import * as anims from "react-animations";
import {buildQueryString, getQueryParamOrElse} from "Utilities/URIUtilities";
import {device, deviceBreakpoint} from "ui-components/Hide";
import {CSSTransition} from "react-transition-group";
import {appendToXterm, useXTerm} from "Applications/Jobs/xterm";
import {VirtualFileTable} from "Files/VirtualFileTable";
import {arrayToPage} from "Types";
import {fileTablePage, mockFile, replaceHomeOrProjectFolder} from "Utilities/FileUtilities";
import {Client, WSFactory} from "Authentication/HttpClientInstance";
import {compute} from "UCloud";
import Job = compute.Job;
import JobParameters = compute.JobParameters;
import {dateToString, dateToTimeOfDayString} from "Utilities/DateUtilities";
import {addStandardDialog} from "UtilityComponents";
import AppParameterValueNS = compute.AppParameterValueNS;
import JobUpdate = compute.JobUpdate;
import {creditFormatter} from "Project/ProjectUsage";
import JobStatus = compute.JobStatus;
import {margin, MarginProps} from "styled-system";
import {useProjectStatus} from "Project/cache";
import {ProjectName} from "Project";
import {getProjectNames} from "Utilities/ProjectUtilities";
import {ConfirmationButton} from "ui-components/ConfirmationAction";

const enterAnimation = keyframes`${anims.pulse}`;
const busyAnim = keyframes`${anims.fadeIn}`;

const Container = styled.div`
  --logoScale: 1;
  --logoBaseSize: 200px;
  --logoSize: calc(var(--logoBaseSize) * var(--logoScale));

  --logoPX: 50px;
  --logoPY: 50px;

  /* NOTE(Dan): 14px are added by MainContainer and sidebar */
  --logoIndentX: calc(var(--sidebarWidth) + var(--logoPX) + 14px);
  --logoIndentY: calc(var(--headerHeight) + var(--logoPY) + 14px);

  /* center while accounting for the frame */
  --logoCenterX: calc((100vw + var(--sidebarWidth) - var(--logoSize)) / 2);
  --logoCenterY: calc((100vh + var(--headerHeight) - var(--logoSize)) / 2);

  margin: 50px; /* when header is not wrapped this should be equal to logoPX and logoPY */
  max-width: 2200px;

  ${device("xs")} {
    margin-left: 0;
    margin-right: 0;
  }

  & {
    display: flex;
    flex-direction: column;
  }

  .logo-wrapper {
    position: absolute;

    left: var(--logoCenterX);
    top: var(--logoCenterY);
  }

  .logo-wrapper.active {
    transition: all 1000ms cubic-bezier(0.57, 0.10, 0.28, 0.84);
    transform: translate3d(calc(-1 * var(--logoCenterX) + var(--logoIndentX)),
    calc(-1 * var(--logoCenterY) + var(--logoIndentY)),
    0);
  }

  .logo-wrapper.active .logo-scale {
    transition: transform 300ms cubic-bezier(0.57, 0.10, 0.28, 0.84);
    transform: scale3d(var(--logoScale),
    var(--logoScale),
    var(--logoScale)) translate3d(calc(var(--logoBaseSize) / (1 / var(--logoScale)) - var(--logoBaseSize)),
    calc(var(--logoBaseSize) / (1 / var(--logoScale)) - var(--logoBaseSize)),
    0);
  }

  .fake-logo {
    /* NOTE(Dan): the fake logo takes the same amount of space as the actual logo, 
       this basically fixes our document flow */
    display: block;
    width: var(--logoSize);
    height: var(--logoSize);
    content: '';
  }

  .data.data-enter-done {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  .data.data-enter-active {
    opacity: 1;
    transform: translate3d(0, 0, 0);
    transition: transform 1000ms cubic-bezier(0.57, 0.10, 0.28, 0.84);
  }

  .data.data-exit {
    opacity: 1;
  }

  .data-exit-active {
    display: none;
  }

  .data {
    width: 100%; /* fix info card width */
    opacity: 0;
    transform: translate3d(0, 50vh, 0);
  }

  .header-text {
    margin-left: 32px;
    margin-top: calc(var(--logoScale) * 16px);
    width: calc(100% - var(--logoBaseSize) * var(--logoScale) - 32px);
    max-width: 1572px; /* TODO(Dan): Hackity, hack, hack */
  }

  ${deviceBreakpoint({maxWidth: "1000px"})} {
    .fake-logo {
      width: 100%; /* force the header to wrap */
    }

    & {
      --logoIndentX: var(--logoCenterX);
    }

    .header {
      text-align: center;
    }

    .header-text {
      margin-left: 0;
      margin-top: 0;
      width: 100%;
    }
  }

  &.IN_QUEUE .logo {
    animation: 2s ${enterAnimation} infinite;
  }

  &.RUNNING {
    --logoScale: 0.5;
  }
`;

// TODO WS calls don't currently have their types generated
interface JobsFollowResponse {
    updates: compute.JobUpdate[];
    log: { rank: number; stdout?: string; stderr?: string }[];
    newStatus?: JobStatus;
}

function useJobUpdates(job: Job | undefined, callback: (entry: JobsFollowResponse) => void): void {
    useEffect(() => {
        if (!job) return;

        const conn = WSFactory.open(
            "/jobs", {
                init: conn => {
                    conn.subscribe({
                        call: "jobs.follow",
                        payload: {id: job.id},
                        handler: message => {
                            const streamEntry = message.payload as JobsFollowResponse;
                            callback(streamEntry);
                        }
                    });
                }
            });

        return () => {
            conn.close();
        };
    }, [job, callback]);
}

interface JobUpdateListener {
    handler: (e: JobsFollowResponse) => void;
}

export const View: React.FunctionComponent = () => {
    const {id} = useParams<{ id: string }>();
    const history = useHistory();

    // Note: This might not match the real app name
    const appNameHint = getQueryParamOrElse(history.location.search, "app", "");
    const action = getQueryParamOrElse(history.location.search, "action", "view");
    const delayInitialAnim = action === "start";

    const [jobFetcher, fetchJob] = useCloudAPI<Job | undefined>({noop: true}, undefined);
    const job = jobFetcher.data;

    const useFakeState = useMemo(() => localStorage.getItem("useFakeState") !== null, []);

    useSidebarPage(SidebarPages.Runs);
    useTitle(`Job ${shortUUID(id)}`);
    useEffect(() => {
        fetchJob(compute.jobs.retrieve({
            id,
            includeParameters: true,
            includeProduct: true,
            includeApplication: true,
            includeUpdates: true
        }));
    }, [id]);

    const [dataAnimationAllowed, setDataAnimationAllowed] = useState<boolean>(false);
    const [logoAnimationAllowed, setLogoAnimationAllowed] = useState<boolean>(false);
    const [status, setStatus] = useState<JobStatus | null>(null);

    useEffect(() => {
        if (useFakeState) {
            const t = setInterval(() => {
                const jobState = (window["fakeState"] as JobState | undefined) ??
                    (localStorage.getItem("fakeState") as JobState | null) ??
                    status?.state;

                if (jobState) {
                    setStatus({
                        state: jobState,
                        startedAt: timestampUnixMs()
                    });
                }
            }, 100);

            return () => {
                clearInterval(t);
            };
        } else {
            return () => {
                // Do nothing
            };
        }
    }, [status]);

    useEffect(() => {
        let t1: number | undefined;
        let t2: number | undefined;
        if (job) {
            t1 = setTimeout(() => {
                setDataAnimationAllowed(true);

                // NOTE(Dan): Remove action to avoid getting delay if the user refreshes their browser
                history.replace(buildQueryString(history.location.pathname, {app: appNameHint}));
            }, delayInitialAnim ? 3000 : 400);

            t2 = setTimeout(() => {
                setLogoAnimationAllowed(true);
            }, delayInitialAnim ? 2200 : 0);
        }

        return () => {
            if (t1) clearTimeout(t1);
            if (t2) clearTimeout(t2);
        };
    }, [job]);

    const jobUpdateCallbackHandlers = useRef<JobUpdateListener[]>([]);
    useEffect(() => {
        jobUpdateCallbackHandlers.current = [{
            handler: (e) => {
                if (!useFakeState) {
                    if (e.newStatus != null) {
                        setStatus(e.newStatus);
                    }
                } else {
                    if (e.newStatus != null) {
                        console.log("Wanted to switch status, but didn't. " +
                            "Remove localStorage useFakeState if you wish to use real status.");
                    }
                }
            }
        }];
    }, [id]);
    const jobUpdateListener = useCallback((e: JobsFollowResponse) => {
        if (!e) return;
        if (e.updates) {
            for (const update of e.updates) job?.updates?.push(update);
        }
        jobUpdateCallbackHandlers.current.forEach(({handler}) => {
            handler(e);
        });
    }, [job]);
    useJobUpdates(job, jobUpdateListener);

    if (jobFetcher.error !== undefined) {
        return <MainContainer main={<Heading.h2>An error occurred</Heading.h2>}/>;
    }

    return <MainContainer
        main={
            <Container className={status?.state ?? "state-loading"}>
                <div className={`logo-wrapper ${logoAnimationAllowed && status ? "active" : ""}`}>
                    <div className="logo-scale">
                        <div className={"logo"}>
                            <AppToolLogo name={job?.parameters?.application?.name ?? appNameHint} type={"APPLICATION"}
                                         size={"200px"}/>
                        </div>
                    </div>
                </div>

                {!job || !status ? null : (
                    <CSSTransition
                        in={status?.state === "IN_QUEUE" && dataAnimationAllowed}
                        timeout={{
                            enter: 1000,
                            exit: 0,
                        }}
                        classNames={"data"}
                        unmountOnExit
                    >
                        <div className={"data"}>
                            <Flex flexDirection={"row"} flexWrap={"wrap"} className={"header"}>
                                <div className={"fake-logo"}/>
                                <div className={"header-text"}>
                                    <InQueueText job={job!}/>
                                </div>
                            </Flex>

                            <Content>
                                <Box width={"100%"} maxWidth={"1572px"} margin={"32px auto"}>
                                    <DashboardCard color={"purple"}>
                                        <Box py={"16px"}>
                                            <ProviderUpdates job={job} updateListeners={jobUpdateCallbackHandlers}/>
                                        </Box>
                                    </DashboardCard>
                                </Box>
                                <InfoCards job={job} status={status}/>
                            </Content>
                        </div>
                    </CSSTransition>
                )}

                {!job || !status ? null : (
                    <CSSTransition
                        in={status?.state === "RUNNING" && dataAnimationAllowed}
                        timeout={{enter: 1000, exit: 0}}
                        classNames={"data"}
                        unmountOnExit
                    >
                        <div className={"data"}>
                            <Flex flexDirection={"row"} flexWrap={"wrap"} className={"header"}>
                                <div className={"fake-logo"}/>
                                <div className={"header-text"}>
                                    <RunningText job={job}/>
                                </div>
                            </Flex>

                            <RunningContent job={job} updateListeners={jobUpdateCallbackHandlers} status={status}/>
                        </div>
                    </CSSTransition>
                )}

                {!job || !status ? null : (
                    <CSSTransition
                        in={isJobStateTerminal(status.state) && dataAnimationAllowed}
                        timeout={{enter: 1000, exit: 0}}
                        classNames={"data"}
                        unmountOnExit
                    >
                        <div className={"data"}>
                            <Flex flexDirection={"row"} flexWrap={"wrap"} className={"header"}>
                                <div className={"fake-logo"}/>
                                <div className={"header-text"}>
                                    <CompletedText job={job} state={status.state}/>
                                </div>
                            </Flex>

                            <Content>
                                <OutputFiles job={job}/>
                                <InfoCards job={job} status={status}/>
                            </Content>
                        </div>
                    </CSSTransition>
                )}
            </Container>
        }
    />;
};

const Content = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const InQueueText: React.FunctionComponent<{ job: Job }> = ({job}) => {
    return <>
        <Heading.h2>{PRODUCT_NAME} is preparing your job</Heading.h2>
        <Heading.h3>
            {job.parameters.name ?
                (<>
                    We are about to
                    launch <i>{job.parameters.resolvedApplication?.metadata?.title ?? job.parameters.application.name} v{job.parameters.application.version}</i>
                    {" "}for <i>{job.parameters.name}</i> (ID: {shortUUID(job.id)})
                </>) :
                (<>
                    We are about to
                    launch <i>{job.parameters.resolvedApplication?.metadata?.title ?? job.parameters.application.name} v{job.parameters.application.version}</i>
                    {" "}(ID: {shortUUID(job.id)})
                </>)
            }
        </Heading.h3>
        <Busy job={job}/>
    </>;
};

const BusyWrapper = styled(Box)`
  display: none;

  &.active {
    animation: 1s ${busyAnim};
    display: block;
  }
`;

const Busy: React.FunctionComponent<{ job: Job }> = ({job}) => {
    const clusterUtilization = 90;
    const numberOfJobs = 50;
    const numberOfJobsInQueue = 10;
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = setTimeout(() => {
            ref.current?.classList.add("active");
        }, 6000);
        return () => {
            clearTimeout(t);
        };
    }, []);

    return <BusyWrapper ref={ref}>
        <Box mt={"16px"}>
            <Box mb={"16px"}>
                Your reserved machine is currently quite popular.
                Cluster utilization is currently at {clusterUtilization}% with {numberOfJobs} jobs running
                and {numberOfJobsInQueue} in the queue.
            </Box>

            <CancelButton job={job} state={"IN_QUEUE"}/>
        </Box>
    </BusyWrapper>;
};

const InfoCardsContainer = styled.div`
  margin-top: 32px;
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(200px, 380px));
  grid-gap: 16px;
  justify-content: center;
`;

const InfoCards: React.FunctionComponent<{ job: Job, status: JobStatus }> = ({job, status}) => {
    let time = job.parameters.timeAllocation;
    if (status.expiresAt && status.startedAt) {
        const msTime = status.expiresAt - status.startedAt;
        time = {
            hours: Math.floor(msTime / (1000 * 3600)),
            minutes: Math.floor((msTime % (1000 * 3600)) / (1000 * 60)),
            seconds: Math.floor((msTime % (1000 * 60)) / (1000))
        };
    }

    const projectNames = getProjectNames(useProjectStatus());

    let prettyTime = "No job deadline";
    if (time) {
        prettyTime = "";
        if (time.hours > 0) {
            prettyTime += time.hours;
            if (time.hours > 1) prettyTime += " hours";
            else prettyTime += " hour";
        }
        if (time.minutes > 0) {
            if (prettyTime !== "") prettyTime += " ";
            prettyTime += time.minutes;
            if (time.minutes > 1) prettyTime += " minutes";
            else prettyTime += " minute";
        }

        if (prettyTime === "") {
            prettyTime = "< 1 minute";
        }
    }

    const projects = useProjectStatus();
    const workspaceTitle = projects.fetch().membership.find(it => it.projectId === job.owner.project)?.title ?? "My Workspace";

    const machine = job.parameters.resolvedProduct;
    const pricePerUnit = machine?.pricePerUnit ?? 0;
    const estimatedCost = time ?
        (time.hours * 60 * pricePerUnit + (time.minutes * pricePerUnit)) * job.parameters.replicas :
        0;

    return <InfoCardsContainer>
        <InfoCard
            stat={job.parameters.replicas.toString()}
            statTitle={job.parameters.replicas === 1 ? "Replica" : "Replicas"}
            icon={"cpu"}
        >
            <b>{job.parameters.product.provider} / {job.parameters.product.id}</b><br/>
            {!machine?.cpu ? null : <>{machine?.cpu}x vCPU </>}

            {machine?.cpu && (machine.memoryInGigs || machine.gpu) ? <>&mdash;</> : null}
            {!machine?.memoryInGigs ? null : <>{machine?.memoryInGigs}GB RAM &mdash;</>}

            {machine?.cpu && machine.gpu ? <>&mdash;</> : null}
            {!machine?.gpu ? null : <>{" "}{machine?.gpu}x GPU</>}
        </InfoCard>
        <InfoCard
            stat={prettyTime}
            statTitle={"Allocated"}
            icon={"hourglass"}
        >
            {!time ? null : <><b>Estimated price:</b> {creditFormatter(estimatedCost, 0)} <br/></>}
            <b>Price per hour:</b> {creditFormatter(pricePerUnit * 60, 0)}
        </InfoCard>
        <InfoCard
            stat={jobFiles(job.parameters).length.toString()}
            statTitle={jobFiles(job.parameters).length === 1 ? "Input file" : "Input files"}
            icon={"ftFolder"}
        >
            {jobInputString(job.parameters, projectNames)}
        </InfoCard>
        <InfoCard stat={workspaceTitle} statTitle={"Project"} icon={"projects"}>
            <b>Launched by:</b> {job.owner.launchedBy}
        </InfoCard>
    </InfoCardsContainer>;
};

const InfoCardContainer = styled.div`
  margin: 15px 10px;
  text-align: center;

  .stat {
    font-size: 250%;
    line-height: 150%;
  }

  .stat-title {
    font-size: 150%;
  }

  .content {
    margin-top: 30px;
    text-align: left;
  }
`;

const InfoCard: React.FunctionComponent<{
    stat: string,
    statTitle: string,
    icon: IconName,
}> = props => {
    return <DashboardCard color={"purple"} isLoading={false}>
        <InfoCardContainer>
            <Icon name={props.icon} size={"60px"} color={"iconColor"} color2={"iconColor2"}/>
            <div className={"stat"}>{props.stat}</div>
            <div className={"stat-title"}>{props.statTitle}</div>
            <div className={"content"}>
                {props.children}
            </div>
        </InfoCardContainer>
    </DashboardCard>;
};

const RunningText: React.FunctionComponent<{ job: Job }> = ({job}) => {
    return <>
        <Heading.h2>
            <i>
                {job.parameters.resolvedApplication?.metadata?.title ?? job.parameters.application.name}
                {" "}v{job.parameters.application.version}
            </i> is now running
        </Heading.h2>
        <Heading.h3>
            You can follow the progress below
            {!job.parameters.name ? null : (<> of <i>{job.parameters.name}</i></>)}
        </Heading.h3>
    </>;
};

const RunningInfoWrapper = styled.div`
  margin-top: 32px;
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-gap: 16px;
  justify-content: center;
`;

const AltButtonGroup = styled.div<{ minButtonWidth: string } & MarginProps>`
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(${props => props.minButtonWidth}, max-content));
  grid-gap: 8px;
  ${margin}
`;

AltButtonGroup.defaultProps = {
    marginTop: "8px",
    marginBottom: "8px"
};

function jobFiles(parameters: JobParameters): AppParameterValueNS.File[] {
    return [...Object.values(parameters.parameters ?? {}), ...(parameters.resources ?? [])]
        .filter(it => it.type === "file") as AppParameterValueNS.File[];
}

function jobInputString(parameters: JobParameters, projects: ProjectName[]): string {
    const allFiles = jobFiles(parameters).map(it => replaceHomeOrProjectFolder(it.path, Client, projects));

    if (allFiles.length === 0) return "No files";
    return joinToString(allFiles, ", ");
}

const RunningContent: React.FunctionComponent<{
    job: Job;
    updateListeners: React.RefObject<JobUpdateListener[]>;
    status: JobStatus;
}> = ({job, updateListeners, status}) => {
    const [commandLoading, invokeCommand] = useCloudCommand();
    const [expiresAt, setExpiresAt] = useState(status.expiresAt);
    const projects = useProjectStatus();
    const workspaceTitle = projects.fetch().membership.find(it => it.projectId === job.owner.project)?.title ?? "My Workspace";
    const extendJob: React.EventHandler<SyntheticEvent<HTMLElement>> = useCallback(async e => {
        const duration = parseInt(e.currentTarget.dataset["duration"]!, 10);
        if (!commandLoading && expiresAt) {
            setExpiresAt(expiresAt + (3600 * 1000 * duration));
            try {
                await invokeCommand(compute.jobs.extend({
                    jobId: job.id,
                    requestedTime: {hours: duration, minutes: 0, seconds: 0}
                }));
            } catch (e) {
                setExpiresAt(expiresAt);
            }
        }
    }, [job.id, commandLoading, expiresAt]);

    useEffectSkipMount(() => {
        setExpiresAt(status.expiresAt);
    }, [status.expiresAt]);

    const projectNames = getProjectNames(useProjectStatus());

    return <>
        <RunningInfoWrapper>
            <DashboardCard color={"purple"} isLoading={false} title={"Job info"} icon={"properties"}>
                <Flex flexDirection={"column"} height={"calc(100% - 57px)"}>
                    {!job.parameters.name ? null : <Box><b>Name:</b> {job.parameters.name}</Box>}
                    <Box><b>ID:</b> {shortUUID(job.id)}</Box>
                    <Box><b>Reservation:</b> {job.parameters.product.provider} / {job.parameters.product.id} (x{job.parameters.replicas})</Box>
                    <Box><b>Input:</b> {jobInputString(job.parameters, projectNames)}</Box>
                    <Box><b>Launched by:</b> {job.owner.launchedBy} in {workspaceTitle}</Box>
                    <Box flexGrow={1}/>
                    <Box mt={"16px"}>
                        <CancelButton job={job} state={"RUNNING"} fullWidth/>
                    </Box>
                </Flex>
            </DashboardCard>
            <DashboardCard color={"purple"} isLoading={false} title={"Time allocation"} icon={"hourglass"}>
                <Flex flexDirection={"column"} height={"calc(100% - 57px)"}>
                    <Box>
                        <b>Job start: </b> {status.startedAt ? dateToString(status.startedAt) : "Not started yet"}
                    </Box>
                    {!expiresAt ? null :
                        <Box>
                            <b>Job expiry: </b> {dateToString(expiresAt)}
                        </Box>
                    }

                    <Box flexGrow={1}/>

                    {!expiresAt ? null :
                        <Box>
                            Extend allocation (hours):
                            <AltButtonGroup minButtonWidth={"50px"} marginBottom={0}>
                                <Button data-duration={"1"} onClick={extendJob}>+1</Button>
                                <Button data-duration={"6"} onClick={extendJob}>+6</Button>
                                <Button data-duration={"12"} onClick={extendJob}>+12</Button>
                                <Button data-duration={"24"} onClick={extendJob}>+24</Button>
                                <Button data-duration={"48"} onClick={extendJob}>+48</Button>
                            </AltButtonGroup>
                        </Box>
                    }
                </Flex>
            </DashboardCard>
            <DashboardCard color={"purple"} isLoading={false} title={"Messages"} icon={"chat"}>
                <ProviderUpdates job={job} updateListeners={updateListeners}/>
            </DashboardCard>
        </RunningInfoWrapper>

        <RunningJobsWrapper>
            {Array(job.parameters.replicas).fill(0).map((_, i) => {
                return <RunningJobRank key={i} job={job} rank={i} updateListeners={updateListeners}/>;
            })}
        </RunningJobsWrapper>
    </>;
};

const RunningJobsWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  margin-top: 32px;

  margin-bottom: 32px;
  grid-gap: 32px;
`;

const RunningJobRankWrapper = styled.div`
  margin-top: 16px;
  margin-bottom: 16px;

  display: grid;
  grid-template-columns: 80px 1fr 200px;
  grid-template-rows: 1fr auto;
  grid-gap: 16px;

  .rank {
    text-align: center;
    width: 100%;
    flex-direction: column;
  }

  .term {
    height: 100%;
  }

  .term .terminal {
    /* NOTE(Dan): This fixes a feedback loop in the xtermjs fit function. Without this, the fit function is
       unable to correctly determine the size of the terminal */
    position: absolute;
  }

  .buttons {
    display: flex;
    flex-direction: column;
  }

  .buttons ${Button} {
    margin-top: 8px;
    width: 100%;
  }

  ${deviceBreakpoint({minWidth: "1001px"})} {
    &.expanded {
      height: 80vh;
    }

    &.expanded .term {
      grid-row: 1;
      grid-column: 2 / 4;
    }

    &.expanded .buttons {
      grid-row: 2;
      grid-column: 2 / 4;
    }
  }

  ${deviceBreakpoint({maxWidth: "1000px"})} {
    grid-template-columns: 1fr !important;

    .term {
      height: 400px;
    }

    .expand-btn {
      display: none;
    }
  }
`;

const RunningJobRank: React.FunctionComponent<{
    job: Job,
    rank: number,
    updateListeners: React.RefObject<JobUpdateListener[]>,
}> = ({job, rank, updateListeners}) => {
    const {termRef, terminal, fitAddon} = useXTerm({autofit: true});
    const [expanded, setExpanded] = useState(false);
    const toggleExpand = useCallback(() => {
        setExpanded(!expanded);
        const targetView = termRef.current?.parentElement;
        if (targetView != null) {
            setTimeout(() => {
                // FIXME(Dan): Work around a weird resizing bug in xterm.js
                fitAddon.fit();
                fitAddon.fit();
                fitAddon.fit();
                window.scrollTo({
                    top: targetView.getBoundingClientRect().top - 100 + window.pageYOffset,
                });
            }, 0);
        }
    }, [expanded, termRef]);

    useEffect(() => {
        updateListeners.current?.push({
            handler: e => {
                for (const logEvent of e.log) {
                    if (logEvent.rank === rank && logEvent.stderr != null) {
                        appendToXterm(terminal, logEvent.stderr);
                    }

                    if (logEvent.rank === rank && logEvent.stdout != null) {
                        appendToXterm(terminal, logEvent.stdout);
                    }
                }
            }
        });

        // NOTE(Dan): Clean up is performed by the parent object
    }, [job.id, rank]);

    return <>
        <DashboardCard color={"purple"} isLoading={false}>
            <RunningJobRankWrapper className={expanded ? "expanded" : undefined}>
                <div className="rank">
                    <Heading.h2>{rank + 1}</Heading.h2>
                    <Heading.h3>Rank</Heading.h3>
                </div>

                <div className={"term"} ref={termRef}/>

                <div className="buttons">
                    <Link to={`/applications/shell/${job.id}/${rank}?hide-frame`} onClick={e => {
                        e.preventDefault();

                        window.open(
                            ((e.target as HTMLDivElement).parentElement as HTMLAnchorElement).href,
                            `shell-${job.id}-${rank}`,
                            "width=800,height=600,status=no"
                        );
                    }}>
                        <Button type={"button"}>
                            Open terminal
                        </Button>
                    </Link>
                    {job.parameters.resolvedApplication?.invocation.applicationType !== "WEB" ? null : (
                        <Link to={`/applications/web/${job.id}/${rank}?hide-frame`} target={"_blank"}>
                            <Button>Open interface</Button>
                        </Link>
                    )}
                    {job.parameters.resolvedApplication?.invocation.applicationType !== "VNC" ? null : (
                        <Link to={`/applications/vnc/${job.id}/${rank}?hide-frame`} target={"_blank"} onClick={e => {
                            e.preventDefault();

                            window.open(
                                ((e.target as HTMLDivElement).parentElement as HTMLAnchorElement).href,
                                `vnc-${job.id}-${rank}`,
                                "width=800,height=450,status=no"
                            );
                        }}>
                            <Button>Open interface</Button>
                        </Link>
                    )}
                    <Button className={"expand-btn"} onClick={toggleExpand}>
                        {expanded ? "Shrink" : "Expand"} output
                    </Button>
                </div>
            </RunningJobRankWrapper>
        </DashboardCard>
    </>;
};

const CompletedTextWrapper = styled.div`
  ${deviceBreakpoint({maxWidth: "1000px"})} {
    ${AltButtonGroup} {
      justify-content: center;
    }
  }
`;

const CompletedText: React.FunctionComponent<{ job: Job, state: JobState }> = ({job, state}) => {
    return <CompletedTextWrapper>
        <Heading.h2>{PRODUCT_NAME} has processed your job</Heading.h2>
        <Heading.h3>
            <i>
                {job.parameters.resolvedApplication?.metadata?.title ?? job.parameters.application.name}
                {" "}v{job.parameters.application.version}
            </i>
            {" "}{state === "SUCCESS" ? "succeeded" : state === "EXPIRED" ? "expired" : "failed"}{" "}
            {job.parameters.name ? <>for <i>{job.parameters.name}</i></> : null}
            {" "}(ID: {shortUUID(job.id)})
        </Heading.h3>
        <AltButtonGroup minButtonWidth={"200px"}>
            <Link to={`/applications/${job.parameters.application.name}/${job.parameters.application.version}`}>
                <Button>Restart application</Button>
            </Link>
        </AltButtonGroup>
    </CompletedTextWrapper>;
};

const OutputFilesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  h1, h2, h3, h4 {
    margin-top: 15px;
    margin-bottom: 15px;
  }
`;

const OutputFiles: React.FunctionComponent<{ job: Job }> = ({job}) => {
    const history = useHistory();
    const filePaths = jobFiles(job.parameters).map(it => mockFile({path: it.path, type: "DIRECTORY"}));
    const outputFolder = job.output?.outputFolder;
    if (outputFolder) filePaths.push(mockFile({path: outputFolder, type: "DIRECTORY"}));
    if (filePaths.length === 0) return null;
    return <OutputFilesWrapper>
        <Heading.h3>Files</Heading.h3>
        <VirtualFileTable
            embedded
            disableNavigationButtons
            previewEnabled
            permissionAlertEnabled={false}
            onFileNavigation={f => history.push(fileTablePage(f))}
            page={arrayToPage(filePaths)}
        />
    </OutputFilesWrapper>;
};

const CancelButton: React.FunctionComponent<{
    job: Job,
    state: JobState,
    fullWidth?: boolean
}> = ({job, state, fullWidth}) => {
    const [loading, invokeCommand] = useCloudCommand();
    const onCancel = useCallback(async () => {
        if (!loading) {
            await invokeCommand(compute.jobs.remove({id: job.id}));
        }
    }, [loading]);

    return <ConfirmationButton
        color={"red"} icon={"trash"} onAction={onCancel} fullWidth={fullWidth}
        actionText={state !== "IN_QUEUE" ? "Stop application" : "Cancel reservation"}
    />;
};

const ProviderUpdates: React.FunctionComponent<{
    job: Job;
    updateListeners: React.RefObject<JobUpdateListener[]>;
}> = ({job, updateListeners}) => {
    const {termRef, terminal} = useXTerm({autofit: true});

    const appendUpdate = useCallback((update: JobUpdate) => {
        if (update.status) {
            appendToXterm(
                terminal,
                `[${dateToTimeOfDayString(update.timestamp)}] ${update.status}
`
            );
        } else if (update.state) {
            let message = "Your job is now: " + stateToTitle(update.state);
            switch (update.state) {
                case "CANCELING":
                    message = "Your job is now canceling";
                    break;
                case "FAILURE":
                    message = "Your job has failed";
                    break;
                case "IN_QUEUE":
                    message = "Your job is now in the queue";
                    break;
                case "SUCCESS":
                    message = "Your job has been processed successfully";
                    break;
                case "RUNNING":
                    message = "Your job is now running";
                    break;
            }
            appendToXterm(
                terminal,
                `[${dateToTimeOfDayString(update.timestamp)}] ${message}\n`
            );
        }
    }, [terminal]);

    useLayoutEffect(() => {
        for (const update of job.updates) {
            appendUpdate(update)
        }
    }, []);

    useLayoutEffect(() => {
        let mounted = true;
        const listener: JobUpdateListener = {
            handler: e => {
                if (!mounted) return;
                for (const update of e.updates) {
                    appendUpdate(update);
                }
            }
        }
        updateListeners.current?.push(listener);
        return () => {
            mounted = false;
        };
    }, [updateListeners]);
    return <Box height={"200px"} ref={termRef}/>
};

export default View;