import {ConfirmationButton} from "ui-components/ConfirmationAction";

const CONF = require("../../site.config.json");
import {
    Area,
    AreaChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
} from "recharts";
import {MainContainer} from "MainContainer/MainContainer";
import * as React from "react";
import {useProjectManagementStatus} from "Project";
import {ProjectBreadcrumbs} from "Project/Breadcrumbs";
import {useLoading, useTitle} from "Navigation/Redux/StatusActions";
import {useSidebarPage, SidebarPages} from "ui-components/Sidebar";
import {accounting, BulkRequest, PageV2, PaginationRequestV2} from "UCloud";
import Product = accounting.Product;
import {
    DateRangeFilter,
    EnumFilter,
    FilterWidgetProps,
    PillProps,
    ResourceFilter,
    ValuePill
} from "Resource/Filter";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {capitalized, doNothing, errorMessageOrDefault, timestampUnixMs} from "UtilityFunctions";
import {DashboardCard} from "Dashboard/Dashboard";
import {ThemeColor} from "ui-components/theme";
import {Box, Button, Flex, Grid, Icon, Input, Label, Text} from "ui-components";
import {getCssVar} from "Utilities/StyledComponentsUtilities";
import {ProductArea} from "Accounting";
import {IconName} from "ui-components/Icon";
import styled from "styled-components";
import ProductCategoryId = accounting.ProductCategoryId;
import {formatDistance} from "date-fns";
import {apiBrowse, APICallState, apiRetrieve, apiUpdate, useCloudAPI, useCloudCommand} from "Authentication/DataHook";
import {bulkRequestOf, emptyPageV2} from "DefaultObjects";
import {useRefreshFunction} from "Navigation/Redux/HeaderActions";
import {Operation, Operations, useOperationOpener} from "ui-components/Operation";
import * as Pagination from "Pagination";
import Table, {TableCell, TableHeader, TableHeaderCell, TableRow} from "ui-components/Table";
import ReactModal from "react-modal";
import {defaultModalStyle} from "Utilities/ModalUtilities";
import ReactDatePicker from "react-datepicker";
import {enGB} from "date-fns/locale";
import {SlimDatePickerWrapper} from "ui-components/DatePicker";
import {getStartOfDay} from "Activity/Page";
import {snackbarStore} from "Snackbar/SnackbarStore";

function dateFormatter(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getDate()}/${date.getMonth() + 1} ` +
        `${date.getHours().toString().padStart(2, "0")}:` +
        `${date.getMinutes().toString().padStart(2, "0")}`;
}

function dateFormatterDay(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getDate()}/${date.getMonth() + 1} `;
}

function dateFormatterMonth(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getFullYear()} `;
}

export function priceExplainer(product: Product): string {
    switch (product.type) {
        case "compute":
            return `${creditFormatter(product.pricePerUnit * 60, 4)}/hour`;
        case "storage":
            return `${creditFormatter(product.pricePerUnit * 30)}/GB per month`;
        default:
            return `${creditFormatter(product.pricePerUnit)}/unit`;
    }
}

export function creditFormatter(credits: number, precision = 2): string {
    if (precision < 0 || precision > 6) throw Error("Precision must be in 0..6");

    // Edge-case handling
    if (credits < 0) {
        return "-" + creditFormatter(-credits);
    } else if (credits === 0) {
        return "0 DKK";
    } else if (credits < Math.pow(10, 6 - precision)) {
        if (precision === 0) return "< 1 DKK";
        let builder = "< 0,";
        for (let i = 0; i < precision - 1; i++) builder += "0";
        builder += "1 DKK";
        return builder;
    }

    // Group into before and after decimal separator
    const stringified = credits.toString().padStart(6, "0");

    let before = stringified.substr(0, stringified.length - 6);
    let after = stringified.substr(stringified.length - 6);
    if (before === "") before = "0";
    if (after === "") after = "0";
    after = after.padStart(precision, "0");
    after = after.substr(0, precision);

    // Truncate trailing zeroes (but keep at least two)
    if (precision > 2) {
        let firstZeroAt = -1;
        for (let i = 2; i < after.length; i++) {
            if (after[i] === "0") {
                if (firstZeroAt === -1) firstZeroAt = i;
            } else {
                firstZeroAt = -1;
            }
        }

        if (firstZeroAt !== -1) { // We have trailing zeroes
            after = after.substr(0, firstZeroAt);
        }
    }

    // Thousand separator
    const beforeFormatted = addThousandSeparators(before);

    if (after === "") return `${beforeFormatted} DKK`;
    else return `${beforeFormatted},${after} DKK`;
}

export function addThousandSeparators(numberOrString: string | number): string {
    const numberAsString = typeof numberOrString === "string" ? numberOrString : numberOrString.toString(10);
    let result = "";
    const chunksInTotal = Math.ceil(numberAsString.length / 3);
    let offset = 0;
    for (let i = 0; i < chunksInTotal; i++) {
        if (i === 0) {
            let firstChunkSize = numberAsString.length % 3;
            if (firstChunkSize === 0) firstChunkSize = 3;
            result += numberAsString.substr(0, firstChunkSize);
            offset += firstChunkSize;
        } else {
            result += '.';
            result += numberAsString.substr(offset, 3);
            offset += 3;
        }
    }
    return result;
}

const productTypes: ProductArea[] = ["STORAGE", "COMPUTE", "INGRESS", "NETWORK_IP", "LICENSE"];

function productTypeToTitle(type: ProductArea): string {
    switch (type) {
        case "INGRESS":
            return "Public Link"
        case "COMPUTE":
            return "Compute";
        case "STORAGE":
            return "Storage";
        case "NETWORK_IP":
            return "Public IP";
        case "LICENSE":
            return "Software License";
    }
}

function productTypeToIcon(type: ProductArea): IconName {
    switch (type) {
        case "INGRESS":
            return "globeEuropeSolid"
        case "COMPUTE":
            return "cpu";
        case "STORAGE":
            return "hdd";
        case "NETWORK_IP":
            return "networkWiredSolid";
        case "LICENSE":
            return "apps";
    }
}

const filterWidgets: React.FunctionComponent<FilterWidgetProps>[] = [];
const filterPills: React.FunctionComponent<PillProps>[] = [];

function registerFilter([w, p]: [React.FunctionComponent<FilterWidgetProps>, React.FunctionComponent<PillProps>]) {
    filterWidgets.push(w);
    filterPills.push(p);
}

registerFilter(DateRangeFilter("calendar", "Usage period", "filterEndDate", "filterStartDate"));
registerFilter(EnumFilter("cubeSolid", "filterType", "Product type", productTypes.map(t => ({
    icon: productTypeToIcon(t),
    title: productTypeToTitle(t),
    value: t
}))));
filterPills.push(props =>
    <ValuePill {...props} propertyName={"filterWorkspace"} secondaryProperties={["filterWorkspaceProject"]}
               showValue={true} icon={"projects"} title={"Workspace"}/>);
filterPills.push(props =>
    <ValuePill {...props} propertyName={"filterAllocation"} showValue={false} icon={"grant"} title={"Allocation"}/>);

interface VisualizationFlags {
    filterStartDate?: number | null;
    filterEndDate?: number | null;
    filterType?: ProductArea | null;
    filterProvider?: string | null;
    filterProductCategory?: string | null;
    filterAllocation?: string | null;
}

function retrieveUsage(request: VisualizationFlags): APICallParameters {
    return apiRetrieve(request, "/api/accounting/visualization", "usage");
}

function retrieveBreakdown(request: VisualizationFlags): APICallParameters {
    return apiRetrieve(request, "/api/accounting/visualization", "breakdown");
}

function browseWallets(request: PaginationRequestV2): APICallParameters {
    return apiBrowse(request, "/api/accounting/wallets");
}

interface TransferRecipient {
    id: string;
    isProject: boolean;
    title: string;
    principalInvestigator: string;
    numberOfMembers: number;
}

function retrieveRecipient(request: { query: string }): APICallParameters {
    return apiRetrieve(request, "/api/accounting/wallets", "recipient");
}

interface DepositToWalletRequestItem {
    recipient: WalletOwner;
    sourceAllocation: string;
    amount: number;
    description: string;
    startDate: number;
    endDate: number;
}

interface TransferToWalletRequestItem {
    categoryId: ProductCategoryId;
    target: WalletOwner;
    source: WalletOwner;
    amount: number;
    startDate: number;
    endDate: number;
}

interface UpdateAllocationRequestItem {
    id: string;
    balance: number;
    startDate: number;
    endDate?: number | null;
    reason: string;
}

function updateAllocation(request: BulkRequest<UpdateAllocationRequestItem>): APICallParameters {
    return apiUpdate(request, "/api/accounting", "allocation");
}

function deposit(request: BulkRequest<DepositToWalletRequestItem>): APICallParameters {
    return apiUpdate(request, "/api/accounting", "deposit");
}

function transfer(request: BulkRequest<TransferToWalletRequestItem>): APICallParameters {
    return apiUpdate(request, "/api/accounting", "transfer");
}

const Resources: React.FunctionComponent = props => {
    const {projectId, reload} = useProjectManagementStatus({isRootComponent: true, allowPersonalProject: true});
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [usage, fetchUsage] = useCloudAPI<{ charts: UsageChart[] }>({noop: true}, {charts: []});
    const [breakdowns, fetchBreakdowns] = useCloudAPI<{ charts: BreakdownChart[] }>({noop: true}, {charts: []});
    const [wallets, fetchWallets] = useCloudAPI<PageV2<Wallet>>({noop: true}, emptyPageV2);
    const [allocations, fetchAllocations] = useCloudAPI<PageV2<SubAllocation>>({noop: true}, emptyPageV2);
    const [allocationGeneration, setAllocationGeneration] = useState(0);

    const [maximizedUsage, setMaximizedUsage] = useState<number | null>(null);

    const onUsageMaximize = useCallback((idx: number) => {
        if (maximizedUsage == null) setMaximizedUsage(idx);
        else setMaximizedUsage(null);
    }, [maximizedUsage]);

    const reloadPage = useCallback(() => {
        fetchUsage(retrieveUsage({...filters}));
        fetchBreakdowns(retrieveBreakdown({...filters}));
        fetchWallets(browseWallets({itemsPerPage: 50, ...filters}));
        fetchAllocations(browseSubAllocations({itemsPerPage: 50, ...filters}));
        setAllocationGeneration(prev => prev + 1);
    }, [filters]);

    const loadMoreAllocations = useCallback(() => {
        fetchAllocations(browseSubAllocations({itemsPerPage: 50, next: allocations.data.next}));
    }, [allocations.data]);

    const filterByAllocation = useCallback((allocationId: string) => {
        setFilters(prev => ({...prev, "filterAllocation": allocationId}))
    }, [setFilters]);
    const filterByWorkspace = useCallback((workspaceId: string, workspaceIsProject: boolean) => {
        setFilters(prev => ({
            ...prev,
            "filterWorkspace": workspaceId,
            "filterWorkspaceProject": workspaceIsProject.toString()
        }));
    }, [setFilters]);

    useTitle("Usage");
    useSidebarPage(SidebarPages.Projects);
    useRefreshFunction(reloadPage);
    useEffect(reloadPage, []);
    useLoading(usage.loading || breakdowns.loading || wallets.loading);

    const usageClassName = usage.data.charts.length > 3 ? "large" : "slim";
    const walletsClassName = wallets.data.items.reduce((prev, current) => prev + current.allocations.length, 0) > 3 ?
        "large" : "slim";
    const breakdownClassName = breakdowns.data.charts.length > 3 ? "large" : "slim";

    return (
        <MainContainer
            header={
                <ProjectBreadcrumbs allowPersonalProject crumbs={[{title: "Resources"}]}/>
            }
            headerSize={60}
            sidebar={<>
                <ResourceFilter
                    embedded={false}
                    pills={filterPills}
                    filterWidgets={filterWidgets}
                    sortEntries={[]}
                    properties={filters}
                    setProperties={setFilters}
                    sortDirection={"ascending"}
                    onSortUpdated={doNothing}
                    onApplyFilters={reloadPage}
                />
            </>}
            main={<Grid gridGap={"16px"}>
                {maximizedUsage == null ? null : <>
                    <UsageChartViewer maximized c={usage.data.charts[maximizedUsage]}
                                      onMaximizeToggle={() => onUsageMaximize(maximizedUsage)}/>
                </>}
                {maximizedUsage != null ? null :
                    <>
                        <VisualizationSection className={usageClassName}>
                            {usage.data.charts.map((it, idx) =>
                                <UsageChartViewer key={idx} c={it} onMaximizeToggle={() => onUsageMaximize(idx)}/>
                            )}
                        </VisualizationSection>
                        <VisualizationSection className={walletsClassName}>
                            {wallets.data.items.map((it, idx) =>
                                <WalletViewer key={idx} wallet={it}/>
                            )}
                        </VisualizationSection>
                        <VisualizationSection className={breakdownClassName}>
                            {breakdowns.data.charts.map((it, idx) =>
                                <DonutChart key={idx} chart={it}/>
                            )}
                        </VisualizationSection>
                        <SubAllocationViewer allocations={allocations} generation={allocationGeneration}
                                             loadMore={loadMoreAllocations} filterByAllocation={filterByAllocation}
                                             filterByWorkspace={filterByWorkspace}/>
                    </>
                }
            </Grid>}
        />
    );
};

type WalletOwner = { type: "user"; username: string } | { type: "project"; projectId: string; };

interface WalletAllocation {
    id: string;
    allocationPath: string;
    balance: number;
    initialBalance: number;
    localBalance: number;
    startDate: number;
    endDate?: number | null;
}

interface Wallet {
    owner: WalletOwner;
    paysFor: ProductCategoryId;
    allocations: WalletAllocation[];
    chargePolicy: "EXPIRE_FIRST";
    productType?: ProductArea | null;
    chargeType?: string | null;
    unit?: string | null;
}

const WalletViewer: React.FunctionComponent<{ wallet: Wallet }> = ({wallet}) => {
    return <>
        {wallet.allocations.map((it, idx) => <AllocationViewer key={idx} wallet={wallet} allocation={it}/>)}
    </>
}

const AllocationViewer: React.FunctionComponent<{
    wallet: Wallet;
    allocation: WalletAllocation;
}> = ({wallet, allocation}) => {
    const [opRef, onContextMenu] = useOperationOpener();
    const [isDeposit, setIsDeposit] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const closeDepositing = useCallback(() => setIsMoving(false), []);
    const [commandLoading, invokeCommand] = useCloudCommand();
    const openMoving = useCallback((isDeposit: boolean) => {
        setIsDeposit(isDeposit);
        setIsMoving(true);
    }, []);
    const callbacks = useMemo(() => ({
        openMoving
    }), [openMoving]);

    const onTransferSubmit = useCallback(async (workspaceId: string, isProject: boolean, amount: number,
                                                startDate: number, endDate: number) => {
        if (isDeposit) {
            await invokeCommand(deposit(bulkRequestOf({
                amount,
                startDate,
                endDate,
                recipient: {
                    type: isProject ? "project" : "user",
                    projectId: workspaceId,
                    username: workspaceId
                },
                description: "Manually initiated " + isDeposit ? "deposit" : "transfer",
                sourceAllocation: allocation.id
            })));
        } else {
            await invokeCommand(transfer(bulkRequestOf({
                amount,
                startDate,
                endDate,
                source: wallet.owner,
                categoryId: wallet.paysFor,
                target: {
                    type: isProject ? "project" : "user",
                    projectId: workspaceId,
                    username: workspaceId
                },

            })));
        }

        setIsMoving(false);
    }, [isDeposit]);
    return <DashboardCard color={"red"} width={"400px"} onContextMenu={isMoving ? undefined : onContextMenu}>
        <TransferDepositModal isDeposit={isDeposit} isOpen={isMoving} onRequestClose={closeDepositing}
                              onSubmit={onTransferSubmit}/>
        <Flex flexDirection={"row"} alignItems={"center"} height={"100%"}>
            <Icon name={wallet.productType ? productTypeToIcon(wallet.productType) : "cubeSolid"}
                  size={"54px"} mr={"16px"}/>
            <Flex flexDirection={"column"} height={"100%"} width={"100%"}>
                <Flex alignItems={"center"}>
                    <div><b>{wallet.paysFor.name} / {wallet.paysFor.provider}</b></div>
                    <Box flexGrow={1}/>
                    <Operations
                        openFnRef={opRef}
                        location={"IN_ROW"}
                        operations={allocationOperations}
                        selected={[]}
                        row={{wallet, allocation}}
                        extra={callbacks}
                        entityNameSingular={"Allocation"}
                    />
                </Flex>
                <div>{creditFormatter(allocation.balance)} remaining</div>
                <div>{creditFormatter(allocation.initialBalance)} allocated</div>
                <Box flexGrow={1} mt={"8px"}/>
                <div><ExpiresIn startDate={allocation.startDate} endDate={allocation.endDate}/></div>
            </Flex>
        </Flex>
    </DashboardCard>;
};

interface AllocationCallbacks {
    openMoving: (isDeposit: boolean) => void;
}

const allocationOperations: Operation<{ wallet: Wallet, allocation: WalletAllocation }, AllocationCallbacks>[] = [{
    text: "Transfer to...",
    icon: "move",
    enabled: selected => selected.length === 1,
    onClick: (selected, cb) => cb.openMoving(false)
}, {
    text: "Deposit into...",
    icon: "grant",
    enabled: selected => selected.length === 1,
    onClick: (selected, cb) => cb.openMoving(true)
}];

const ExpiresIn: React.FunctionComponent<{ startDate: number, endDate?: number | null; }> = ({startDate, endDate}) => {
    const now = timestampUnixMs();
    if (endDate == null) {
        return <>No expiration</>;
    } else if (now < startDate) {
        return <>Starts in {formatDistance(new Date(startDate), new Date(now))}</>;
    } else if (now < endDate) {
        return <>Expires in {formatDistance(new Date(endDate), new Date(now))}</>;
    } else {
        return <>Expires soon</>;
    }
};

interface UsageChart {
    type: ProductArea;
    periodUsage: number;
    chargeType: string;
    unit: string;
    chart: {
        lines: {
            name: string;
            points: {
                timestamp: number;
                value: number;
            }[]
        }[]
    }
}

const VisualizationSection = styled.div`
  --gutter: 16px;

  display: grid;
  grid-gap: 16px;
  padding: 10px;

  &.large {
    grid-auto-columns: 400px;
    grid-template-rows: minmax(100px, 1fr) minmax(100px, 1fr);
    grid-auto-flow: column;
  }

  &.slim {
    grid-template-columns: repeat(auto-fit, 400px);
  }

  overflow-x: auto;
  scroll-snap-type: x proximity;
  padding-bottom: calc(.75 * var(--gutter));
  margin-bottom: calc(-.25 * var(--gutter));
`;

const UsageChartStyle = styled.div`
  .usage-chart {
    width: calc(100% + 32px) !important;
    margin: -16px;
  }
`;

const UsageChartViewer: React.FunctionComponent<{
    c: UsageChart;
    maximized?: boolean;
    onMaximizeToggle: () => void;
}> = ({c, maximized, onMaximizeToggle}) => {
    const [flattenedLines, names] = useMemo(() => {
        const names: string[] = [];
        const work: Record<string, Record<string, any>> = {};
        for (const line of c.chart.lines) {
            names.push(line.name);
            for (const point of line.points) {
                const key = point.timestamp.toString();
                const entry: Record<string, any> = work[key] ?? {};
                entry["timestamp"] = point.timestamp;
                entry[line.name] = point.value;
                work[key] = entry;
            }
        }

        const result: Record<string, any>[] = [];
        Object.keys(work).map(it => parseInt(it)).sort().forEach(bucket => {
            result.push(work[bucket]);
        });

        for (let i = 0; i < result.length; i++) {
            const previousBucket = i > 0 ? result[i - 1] : null;
            const currentBucket = result[i];

            for (const name of names) {
                if (!currentBucket.hasOwnProperty(name)) {
                    currentBucket[name] = previousBucket?.[name] ?? 0;
                }
            }
        }
        return [result, names];
    }, [c.chart]);

    return <DashboardCard color={"blue"} width={maximized ? "100%" : "400px"} height={maximized ? "900px" : undefined}>
        <UsageChartStyle>
            <Flex alignItems={"center"}>
                <div>
                    <Text color="gray">{productTypeToTitle(c.type)}</Text>
                    <Text bold my="-6px" fontSize="24px">{creditFormatter(c.periodUsage)} used</Text>
                </div>
                <Box flexGrow={1}/>
                <Icon name={"fullscreen"} cursor={"pointer"} onClick={onMaximizeToggle}/>
            </Flex>

            <ResponsiveContainer className={"usage-chart"} height={maximized ? 800 : 170}>
                <AreaChart
                    margin={{
                        left: 0,
                        top: 4,
                        right: 0,
                        bottom: -28
                    }}
                    data={flattenedLines}
                >
                    <XAxis dataKey={"timestamp"}/>
                    <Tooltip labelFormatter={dateFormatter} formatter={creditFormatter}/>
                    {names.map((it, index) =>
                        <Area
                            key={it}
                            type={"linear"}
                            opacity={0.8}
                            dataKey={it}
                            strokeWidth={"2px"}
                            stroke={getCssVar(("dark" + capitalized(COLORS[index % COLORS.length]) as ThemeColor))}
                            fill={getCssVar(COLORS[index % COLORS.length])}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </UsageChartStyle>
    </DashboardCard>
};

const COLORS: [ThemeColor, ThemeColor, ThemeColor, ThemeColor, ThemeColor] = ["green", "red", "blue", "orange", "yellow"];

interface BreakdownChart {
    type: ProductArea;
    chargeType: string;
    unit: string;
    chart: { points: { name: string, value: number }[] }
}

function toPercentageString(value: number) {
    return `${Math.round(value * 10_000) / 100} %`
}

const DonutChart: React.FunctionComponent<{ chart: BreakdownChart }> = props => {
    const totalUsage = props.chart.chart.points.reduce((prev, current) => prev + current.value, 0);
    return (
        <DashboardCard
            height="400px"
            width={"400px"}
            color="purple"
            title={productTypeToTitle(props.chart.type)}
            icon={productTypeToIcon(props.chart.type)}
        >
            <Text color="darkGray" fontSize={1}>Usage across different products</Text>

            <Flex justifyContent={"center"}>
                <PieChart width={215} height={215}>
                    <Pie
                        data={props.chart.chart.points}
                        fill="#8884d8"
                        dataKey="value"
                        innerRadius={55}
                    >
                        {props.chart.chart.points.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={getCssVar(COLORS[index % COLORS.length])}/>
                        ))}
                    </Pie>
                </PieChart>
            </Flex>

            <Flex pb="12px" style={{overflowX: "auto"}} justifyContent={"center"}>
                {props.chart.chart.points.map((it, index) =>
                    <Box mx="4px" width="auto" style={{whiteSpace: "nowrap"}} key={it.name}>
                        <Text textAlign="center" fontSize="14px">{it.name}</Text>
                        <Text
                            textAlign="center"
                            color={getCssVar(COLORS[index % COLORS.length])}
                        >
                            {toPercentageString(it.value / totalUsage)}
                        </Text>
                    </Box>
                )}
            </Flex>
        </DashboardCard>
    )
}

interface SubAllocation {
    id: string;
    startDate: number;
    endDate?: number | null;

    productCategoryId: ProductCategoryId;
    chargeType: string;
    unit: string;

    workspaceId: string;
    workspaceTitle: string;
    workspaceIsProject: boolean;

    remaining: number;
}

function browseSubAllocations(request: PaginationRequestV2): APICallParameters {
    return apiBrowse(request, "/api/accounting/wallets", "subAllocation");
}

const SubAllocationViewer: React.FunctionComponent<{
    allocations: APICallState<PageV2<SubAllocation>>;
    generation: number;
    loadMore: () => void;
    filterByAllocation: (allocationId: string) => void;
    filterByWorkspace: (workspaceId: string, isProject: boolean) => void;
}> = ({allocations, loadMore, generation, filterByAllocation, filterByWorkspace}) => {
    const cb = useMemo(() => ({filterByAllocation, filterByWorkspace}), [filterByAllocation, filterByWorkspace])
    return <DashboardCard color={"green"} title={"Sub-allocations"} icon={"grant"}>
        <Text color="darkGray" fontSize={1}>
            An overview of workspaces which have received a <i>grant</i> or a <i>deposit</i> from you
        </Text>

        <Pagination.ListV2
            infiniteScrollGeneration={generation}
            loading={allocations.loading}
            page={allocations.data}
            onLoadMore={loadMore}
            pageRenderer={(page: SubAllocation[]) => {
                return <Table mt={"8px"}>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell textAlign={"left"}>Workspace</TableHeaderCell>
                            <TableHeaderCell textAlign={"left"}>Category</TableHeaderCell>
                            <TableHeaderCell textAlign={"left"}>Remaining</TableHeaderCell>
                            <TableHeaderCell textAlign={"left"}>Active</TableHeaderCell>
                            <TableHeaderCell width={"35px"}/>
                        </TableRow>
                    </TableHeader>
                    <tbody>
                    {page.map((row, idx) => <SubAllocationRow key={idx} row={row} cb={cb}/>)}
                    </tbody>
                </Table>;
            }}
        />
    </DashboardCard>;
};

const SubAllocationRow: React.FunctionComponent<{ row: SubAllocation, cb: SubAllocationCallbacks }> = ({row, cb}) => {
    const [opRef, onContextMenu] = useOperationOpener()

    return <TableRow onContextMenu={onContextMenu} highlightOnHover>
        <TableCell>
            <Icon name={row.workspaceIsProject ? "projects" : "user"} mr={"8px"} color={"iconColor"}
                  color2={"iconColor2"}/>
            {row.workspaceTitle}
        </TableCell>
        <TableCell>{row.productCategoryId.name} / {row.productCategoryId.provider}</TableCell>
        <TableCell>{creditFormatter(row.remaining)}</TableCell>
        <TableCell><ExpiresIn startDate={row.startDate} endDate={row.endDate}/></TableCell>
        <TableCell>
            <Operations
                openFnRef={opRef}
                location={"IN_ROW"}
                row={row}
                operations={subAllocationOperations}
                selected={[]}
                extra={cb}
                entityNameSingular={"Allocation"}
            />
        </TableCell>
    </TableRow>
};

interface SubAllocationCallbacks {
    filterByAllocation: (allocationId: string) => void;
    filterByWorkspace: (workspaceId: string, isProject: boolean) => void;
}

const subAllocationOperations: Operation<SubAllocation, SubAllocationCallbacks>[] = [{
    icon: "filterSolid",
    text: "Focus on allocation",
    onClick: (selected, cb) => cb.filterByAllocation(selected[0].id),
    enabled: selected => selected.length === 1
}, {
    icon: "filterSolid",
    text: "Focus on workspace",
    onClick: (selected, cb) => cb.filterByWorkspace(selected[0].workspaceId, selected[0].workspaceIsProject),
    enabled: selected => selected.length === 1
}, {
    icon: "edit",
    text: "Edit",
    onClick: doNothing,
    enabled: selected => selected.length === 1
}];

const transferModalStyle = {content: {...defaultModalStyle.content, width: "480px", height: "550px"}};

const TransferDepositModal: React.FunctionComponent<{
    isDeposit: boolean;
    isOpen: boolean;
    onRequestClose: () => void;
    onSubmit: (recipientId: string, recipientIsProject: boolean, amount: number, startDate: number, endDate: number) => void;
}> = ({isDeposit, isOpen, onRequestClose, onSubmit}) => {
    const [recipient, setRecipient] = useState<TransferRecipient | null>(null);
    const [lookingForRecipient, setLookingForRecipient] = useState(false);
    const [createdAfter, setCreatedAfter] = useState(getStartOfDay(new Date()).getTime());
    const [createdBefore, setCreatedBefore] = useState<number | undefined>(undefined);
    const [recipientQuery, fetchRecipient] = useCloudAPI<TransferRecipient | null>({noop: true}, null);
    const recipientQueryField = useRef<HTMLInputElement>(null);
    const amountField = useRef<HTMLInputElement>(null);
    const onRecipientQuery = useCallback((e) => {
        e.preventDefault();
        fetchRecipient(retrieveRecipient({query: recipientQueryField.current?.value ?? ""}));
    }, []);
    const onRecipientConfirm = useCallback(() => {
        if (recipientQuery.data) {
            setRecipient(recipientQuery.data);
            setLookingForRecipient(false);
        }
    }, [recipientQuery]);
    const close = useCallback(() => {
        setRecipient(null);
        setLookingForRecipient(false);
        onRequestClose();
    }, [onRequestClose]);

    const updateDates = useCallback((dates: [Date, Date] | Date) => {
        if (Array.isArray(dates)) {
            const [start, end] = dates;
            const newCreatedAfter = start.getTime();
            const newCreatedBefore = end?.getTime();
            setCreatedAfter(newCreatedAfter);
            setCreatedBefore(newCreatedBefore);
        } else {
            const newCreatedAfter = dates.getTime();
            setCreatedAfter(newCreatedAfter);
            setCreatedBefore(undefined);
        }
    }, []);

    const doSubmit = useCallback(() => {
        if (recipient && createdBefore) {
            const amount = parseInt(amountField.current?.value ?? "0");
            onSubmit(recipient.id, recipient.isProject, amount, createdAfter, createdBefore);
        } else {
            if (!recipient) snackbarStore.addFailure("Missing recipient", false);
            if (!createdBefore) snackbarStore.addFailure("The allocation is missing an end-date", false);
        }
    }, [onSubmit, createdAfter, createdBefore, recipient]);

    return <ReactModal
        isOpen={isOpen}
        onRequestClose={close}
        shouldCloseOnEsc
        ariaHideApp={false}
        style={transferModalStyle}
    >
        {lookingForRecipient ? null :
            <Grid gridGap={16}>
                <div>
                    <Label>Recipient:</Label>
                    {recipient == null ? "None" : <>
                        <Icon name={recipient.isProject ? "projects" : "user"} mr={8}
                              color={"iconColor"} color2={"iconColor2"} />
                        {recipient.title}
                    </>}
                    <Icon name={"edit"} color={"iconColor"} color2={"iconColor2"} size={16} cursor={"pointer"}
                          onClick={() => setLookingForRecipient(true)} ml={8}/>
                </div>

                <Label>
                    Amount:
                    <Input ref={amountField}/>
                </Label>

                <div>
                    <Label>Allocation Period:</Label>
                    <SlimDatePickerWrapper>
                        <ReactDatePicker
                            locale={enGB}
                            startDate={new Date(createdAfter)}
                            endDate={createdBefore ? new Date(createdBefore) : undefined}
                            onChange={updateDates}
                            selectsRange={true}
                            inline
                            dateFormat="dd/MM/yy HH:mm"
                        />
                    </SlimDatePickerWrapper>
                </div>

                <ConfirmationButton actionText={isDeposit ? "Deposit" : "Transfer"} icon={isDeposit ? "grant" : "move"}
                                    onAction={doSubmit} />
            </Grid>
        }
        {!lookingForRecipient ? null : <Grid gridGap={16}>
            <div>
                <p>
                    Enter the
                    <Icon name={"id"} size={16} mx={8} color={"iconColor"} color2={"iconColor2"}/>
                    of the user, if the recipient is a personal workspace. Otherwise, enter the
                    <Icon name={"projects"} size={16} mx={8} color={"iconColor"} color2={"iconColor2"}/>.
                </p>

                <p>
                    The recipient can find this information in the lower-left corner of the
                    {" "}{CONF.PRODUCT_NAME} interface.
                </p>
            </div>

            <form onSubmit={onRecipientQuery}>
                <Label>
                    Recipient:
                    <Input ref={recipientQueryField}/>
                </Label>
                <Button my={16} fullWidth type={"submit"}>Validate</Button>
            </form>

            {!recipientQuery.error ? null : <>
                {recipientQuery.error.why}
            </>}

            {!recipientQuery.data ? null : <>
                <div><b>Workspace: </b> {recipientQuery.data?.title}</div>
                <div><b>Principal Investigator: </b> {recipientQuery.data?.principalInvestigator}</div>
                <div><b>Number of members: </b> {recipientQuery.data?.numberOfMembers}</div>
                <Button fullWidth color={"green"} onClick={onRecipientConfirm}>Use this recipient</Button>
            </>}
        </Grid>}
    </ReactModal>
}

export default Resources;