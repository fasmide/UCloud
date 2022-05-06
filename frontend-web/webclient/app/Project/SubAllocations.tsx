import * as React from "react";
import styled from "styled-components";
import {Box, Button, ButtonGroup, Flex, Grid, Icon, Input, Label, Text, TextArea, Tooltip} from "@/ui-components";
import * as Heading from "@/ui-components/Heading";
import {
    ChargeType,
    deposit,
    DepositToWalletRequestItem,
    explainAllocation, normalizeBalanceForBackend,
    normalizeBalanceForFrontend, ProductPriceUnit, ProductType,
    productTypes,
    productTypeToIcon,
    productTypeToTitle,
    updateAllocation,
    UpdateAllocationRequestItem,
    Wallet,
    WalletAllocation
} from "@/Accounting";
import {APICallState, callAPI, useCloudCommand} from "@/Authentication/DataHook";
import {PageV2} from "@/UCloud";
import {MutableRefObject, useCallback, useMemo, useRef, useState} from "react";
import {displayErrorMessageOrDefault, errorMessageOrDefault, stopPropagationAndPreventDefault} from "@/UtilityFunctions";
import {bulkRequestOf} from "@/DefaultObjects";
import {SubAllocation} from "@/Project/index";
import {Accordion} from "@/ui-components/Accordion";
import {Spacer} from "@/ui-components/Spacer";
import format from "date-fns/format";
import {ListRow} from "@/ui-components/List";
import {dialogStore} from "@/Dialog/DialogStore";
import {DatePicker} from "@/ui-components/DatePicker";
import {InputLabel} from "@/ui-components/Input";
import {startOfDay} from "date-fns/esm";
import ClickableDropdown from "@/ui-components/ClickableDropdown";
import {snackbarStore} from "@/Snackbar/SnackbarStore";
import {AllocationViewer} from "./Resources";
import {largeModalStyle} from "@/Utilities/ModalUtilities";
import {ListV2} from "@/Pagination";

function titleForSubAllocation(alloc: SubAllocation): string {
    return rawAllocationTitleInRow(alloc.productCategoryId.name, alloc.productCategoryId.provider);
}

function rawAllocationTitleInRow(category: string, provider: string) {
    return `${category} @ ${provider}`;
}

export const SubAllocationViewer: React.FunctionComponent<{
    wallets: APICallState<PageV2<Wallet>>;
    allocations: APICallState<PageV2<SubAllocation>>;
    generation: number;
    loadMore: () => void;
    onQuery: (query: string) => void;
    filterByAllocation: (allocationId: string) => void;
    filterByWorkspace: (workspaceId: string, isProject: boolean) => void;
}> = ({allocations, generation, loadMore, wallets, onQuery}) => {
    const reload = useCallback(() => {
        const query = document.querySelector<HTMLInputElement>("#resource-search");
        if (query != null) {
            onQuery(query.value);
        }
    }, [onQuery]);

    const onSearchInput = useCallback((ev: React.KeyboardEvent) => {
        if (ev.code === "Enter" || ev.code === "NumpadEnter") {
            const target = ev.target as HTMLInputElement;
            ev.preventDefault();
            onQuery(target.value);
        }
    }, [onQuery]);

    return <>
        <Spacer
            mr="15px"
            left={<Heading.h3>Sub-allocations</Heading.h3>}
            right={
                <SearchInput>
                    <Input id={"resource-search"} placeholder={"Search in allocations..."} onKeyDown={onSearchInput} />
                    <Label ml="-15px" htmlFor={"resource-search"}>
                        <Icon name={"search"} size={"20px"} />
                    </Label>
                </SearchInput>
            }
        />

        <Text color="darkGray" fontSize={1} mb={"16px"}>
            An overview of workspaces which have received a <i>grant</i> or a <i>deposit</i> from you
        </Text>

        <ListV2
            infiniteScrollGeneration={generation}
            page={allocations.data}
            pageRenderer={page => <SuballocationRows rows={page} wallets={wallets.data.items} reload={reload} />}
            loading={allocations.loading || wallets.loading}
            onLoadMore={loadMore}
        />
    </>;
};

function SuballocationRows(props: {
    rows: SubAllocation[];
    reload(): void;
    wallets: Wallet[];
}): JSX.Element {
    return React.useMemo(() => {
        const groupedByName: {[key: string]: SubAllocation[]} = {};
        props.rows.forEach(row => {
            if (groupedByName[row.workspaceTitle]) {
                groupedByName[row.workspaceTitle].push(row);
            } else {
                groupedByName[row.workspaceTitle] = [row];
            }
        });

        const keys = Object.keys(groupedByName);

        return <Box>
            {keys.map((key, index) => <SuballocationGroup key={key} isLast={keys.length - 1 === index} entryKey={key} rows={groupedByName[key]} wallets={props.wallets} reload={props.reload} />)}
        </Box>
    }, [props.rows, props.wallets]);
}

function findChangedAndMapToRequest(oldAllocs: SubAllocation[], newAllocs: SubAllocation[]): APICallParameters | null {
    const updated: UpdateAllocationRequestItem[] = [];
    for (const [index, oldEntry] of oldAllocs.entries()) {
        const newEntry = newAllocs[index];
        if (isNaN(newEntry.remaining)) newEntry.remaining = oldEntry.remaining;
        if (!isEqual(oldEntry, newEntry)) {
            updated.push({
                id: newEntry.id,
                balance: newEntry.remaining,
                startDate: newEntry.startDate,
                endDate: newEntry.endDate ?? undefined,
                reason: "Allocation updated by grant giver"
            });
        }
    }
    if (updated.length === 0) return null;
    return updateAllocation(bulkRequestOf(...updated));
}

function isEqual(oldAlloc: SubAllocation, newAlloc: SubAllocation): boolean {
    if (oldAlloc.startDate != newAlloc.startDate) return false;
    if (oldAlloc.endDate != newAlloc.endDate) return false;
    if (oldAlloc.remaining != newAlloc.remaining) return false;
    return true;
}


interface SuballocationCreationRow {
    id: number;
    productType: ProductType;
    startDate: number;
    endDate?: number;
    amount?: number;
    wallet?: Wallet;
    allocationId: string;
}

function entriesByUnitAndChargeType(suballocations: SubAllocation[], productType: ProductType) {
    const byUnitAndChargeType = {ABSOLUTE: {}, DIFFERENTIAL_QUOTA: {}};
    for (const entry of suballocations) {
        if (byUnitAndChargeType[entry.chargeType][entry.unit] == null) byUnitAndChargeType[entry.chargeType][entry.unit] = entry.remaining;
        else byUnitAndChargeType[entry.chargeType][entry.unit] += entry.remaining;
    }

    const result = {
        ABSOLUTE: Object.keys(byUnitAndChargeType.ABSOLUTE).map((it: ProductPriceUnit) => normalizeBalanceForFrontend(
            byUnitAndChargeType.ABSOLUTE[it],
            productType,
            "ABSOLUTE",
            it,
            false,
            2
        ) + " " + explainAllocation(productType, "ABSOLUTE", it)),
        DIFFERENTIAL_QUOTA: Object.keys(byUnitAndChargeType.DIFFERENTIAL_QUOTA).map((it: ProductPriceUnit) => normalizeBalanceForFrontend(
            byUnitAndChargeType.DIFFERENTIAL_QUOTA[it],
            productType,
            "DIFFERENTIAL_QUOTA",
            it,
            false,
            2
        ) + " " + explainAllocation(productType, "DIFFERENTIAL_QUOTA", it))
    }

    return result;
}

function SuballocationGroup(props: {entryKey: string; rows: SubAllocation[]; reload(): void; wallets: Wallet[]; isLast: boolean;}): JSX.Element {
    const isProject = props.rows[0].workspaceIsProject;

    const storageRemaining = React.useMemo(() => {
        const storageEntries = props.rows.filter(it => it.productType === "STORAGE");
        const storages = entriesByUnitAndChargeType(storageEntries, "STORAGE");
        return <Flex>{Object.keys(storages).flatMap((s: ChargeType) => storages[s].map(e => <React.Fragment key={e}><Icon mx="12px" name="hdd" />{e}</React.Fragment>))}</Flex>
    }, [props.rows]);

    const computeRemaining = React.useMemo(() => {
        const computeEntries = props.rows.filter(it => it.productType === "COMPUTE");
        const computes = entriesByUnitAndChargeType(computeEntries, "COMPUTE");
        return <Flex>{Object.keys(computes).flatMap((s: ChargeType) => computes[s].map(e => <React.Fragment key={e}><Icon mx="12px" name="cpu" />{e}</React.Fragment>))}</Flex>
    }, [props.rows]);

    const [editing, setEditing] = useState(false);
    const [loading, invokeCommand] = useCloudCommand();

    /* TODO(Jonas): Use context? */
    const editEntries = useRef<{[id: string]: SubAllocation}>({});
    /* TODO(Jonas): End */

    React.useEffect(() => {
        editEntries.current = {};
        if (editing) {
            props.rows.forEach(it => {
                editEntries.current[it.id] = {...it};
            });
        }
    }, [props.rows, editing]);

    const updateRows = useCallback(async () => {
        try {
            const edited = props.rows.map(it => editEntries.current[it.id]);
            const request = findChangedAndMapToRequest(props.rows, edited);
            if (request != null) {
                await callAPI(request);
                setEditing(false);
                props.reload();
            } else {
                snackbarStore.addInformation("No rows have been changed.", false);
            }
        } catch (e) {
            displayErrorMessageOrDefault(e, "Update failed");
        }
    }, []);

    const [creationRows, setCreationRows] = useState<SuballocationCreationRow[]>([]);

    const submitNewRows = React.useCallback(async (creationRows: SuballocationCreationRow[]): Promise<void> => {
        const mappedRows: DepositToWalletRequestItem[] = [];
        for (const [index, row] of creationRows.entries()) {
            if (row.allocationId == "") {
                /* NOTE(Jonas): Should not be possible, but let's make sure it's handled. */
                snackbarStore.addFailure(`Row #${index + 1} is missing an allocation selection`, false);
                return;
            }

            if (row.amount == null || isNaN(row.amount)) {
                snackbarStore.addFailure(`Row #${index + 1} is missing an amount`, false);
                return;
            } else if (row.amount < 1) {
                snackbarStore.addFailure(`Row #${index + 1}'s amount must be more than 0.`, false);
                return;
            }

            mappedRows.push({
                amount: row.amount,
                description: "",
                recipient: isProject ? {type: "project", projectId: props.rows[0].workspaceId} : {type: "user", username: props.entryKey},
                sourceAllocation: row.allocationId,
                startDate: row.startDate,
                endDate: row.endDate,
            });
        }

        if (mappedRows.length > 0) {

            let reason = "";

            dialogStore.addDialog(<Box>
                <Heading.h3>Reason for sub-allocations</Heading.h3>
                <Box height="290px" mb="10px">
                    <TextArea
                        placeholder="Explain the reasoning for the new suballocation..."
                        style={{height: "100%"}}
                        width="100%"
                        onChange={e => reason = e.target.value}
                    />
                </Box>
                <ButtonGroup><Button onClick={async () => {
                    if (!reason) {
                        snackbarStore.addFailure("Reason can't be empty", false);
                        return;
                    }
                    mappedRows.forEach(it => it.description = reason);
                    try {
                        await invokeCommand(deposit(bulkRequestOf(...mappedRows)));
                        setCreationRows([]);
                        props.reload();
                        dialogStore.success();
                    } catch (e) {
                        errorMessageOrDefault(e, "Failed to submit rows");
                    }
                }} color="green">Confirm</Button><Button color="red" onClick={() => dialogStore.failure()}>Cancel</Button></ButtonGroup>
            </Box>, () => undefined);
        } else {
            // Note(Jonas): Technically not reachable, as submit is only available when >0 rows are shown.
            // Should be caught in earlier checks, but let's keep it here, to make sure this issue doesn't pop up
            // during a re-write of the code.
            snackbarStore.addFailure("No rows to submit", false);
        }

    }, [])

    const allocationsByProductTypes = useMemo((): {
        [key: string]: {
            wallet: Wallet;
            allocations: WalletAllocation[];
        }[]
    } => ({
        ["COMPUTE" as ProductType]: findValidAllocations(props.wallets, "COMPUTE"),
        ["STORAGE" as ProductType]: findValidAllocations(props.wallets, "STORAGE"),
        ["INGRESS" as ProductType]: findValidAllocations(props.wallets, "INGRESS"),
        ["LICENSE" as ProductType]: findValidAllocations(props.wallets, "LICENSE"),
        ["NETWORK_IP" as ProductType]: findValidAllocations(props.wallets, "NETWORK_IP")
    }), [props.wallets])

    const idRef = useRef(0);
    const addNewRow = React.useCallback(() => setCreationRows(rows => {
        const firstProductTypeWithEntries = productTypes.find(it =>
            hasValidAllocations(allocationsByProductTypes[it])
        );

        if (!firstProductTypeWithEntries) {
            snackbarStore.addFailure("No available allocations to use", false);
            return rows;
        }

        rows.push({
            id: idRef.current++,
            productType: firstProductTypeWithEntries,
            amount: undefined,
            endDate: undefined,
            startDate: startOfDay(new Date()).getTime(),
            wallet: allocationsByProductTypes[firstProductTypeWithEntries][0].wallet,
            allocationId: allocationsByProductTypes[firstProductTypeWithEntries][0].allocations[0].id
        });
        return [...rows];
    }), [props.wallets]);



    const removeRow = React.useCallback((id: number) => {
        setCreationRows(rows => [...rows.filter(it => it.id !== id)]);
    }, []);

    const selectAllocation = React.useCallback((allocationAndWallets: {
        wallet: Wallet;
        allocations: WalletAllocation[];
    }[], id: number) => {
        dialogStore.addDialog(
            <Box width="830px">
                <Heading.h3>Available Allocations</Heading.h3>
                <Grid gridTemplateColumns={`repeat(2 , 1fr)`} gridGap="15px">
                    {allocationAndWallets.flatMap(it => it.allocations.map(allocation =>
                        <Box key={allocation.allocationPath} height="120px" onClick={() => {
                            setCreationRows(rows => {
                                rows[id].wallet = it.wallet;
                                rows[id].allocationId = allocation.id;
                                return [...rows];
                            });
                            dialogStore.success();
                        }}>
                            <AllocationViewer allocation={allocation} wallet={it.wallet} simple={false} />
                        </Box>
                    ))}
                </Grid>
            </Box>, () => undefined, false, largeModalStyle);
    }, []);

    const addRowButtonEnabled = React.useMemo(() => {
        for (const pt of productTypes) {
            if (hasValidAllocations(allocationsByProductTypes[pt])) {
                return true;
            }
        }
        return false;
    }, [allocationsByProductTypes]);

    return React.useMemo(() =>
        <Accordion
            key={props.entryKey}
            icon={isProject ? "projects" : "user"}
            iconColor2="white"
            title={props.entryKey}
            forceOpen={editing || creationRows.length > 0}
            noBorder={props.isLast}
            titleContent={<Flex>{storageRemaining} {computeRemaining}</Flex>}
            titleContentOnOpened={<>
                {addRowButtonEnabled ? <Button ml="8px" mt="-5px" mb="-8px" height="32px" onClick={addNewRow}>New Row</Button> :
                    <Tooltip trigger={<Button ml="8px" mt="-5px" mb="-8px" height="32px" disabled>New Row</Button>}>
                        No allocations available for use.
                    </Tooltip>
                }
                {editing ?
                    <ButtonGroup ml="8px" mb="-8px" mt="-5px" height="32px">
                        <Button color="green" onClick={updateRows}>Update</Button>
                        <Button color="red" onClick={() => setEditing(false)}>Cancel</Button>
                    </ButtonGroup> : <Button ml="8px" mt="-5px" mb="-8px" height="32px" onClick={() => setEditing(true)}>Edit</Button>}
            </>}
        >
            <Box px="12px">
                {creationRows.length === 0 ? null : <Spacer my="4px" right={<Button ml="8px" mt="2px" disabled={loading} height="32px" onClick={() => submitNewRows(creationRows)}>Submit New Rows</Button>} left={null} />}
                {creationRows.map((row, index) => {
                    const productAndProvider = row.wallet ? <Text>{row.wallet.paysFor.name} @ {row.wallet.paysFor.provider}</Text> : null;
                    const remainingProductTypes = productTypes.filter(it => it !== row.productType);

                    return (
                        <ListRow
                            key={row.id}
                            icon={<Box pl="20px">
                                <ClickableDropdown useMousePositioning width="190px" chevron trigger={<Icon name={productTypeToIcon(row.productType)} />}>
                                    {remainingProductTypes.map(pt => {
                                        const allowProductSelect = hasValidAllocations(allocationsByProductTypes[pt]);
                                        return allowProductSelect ?
                                            <Flex height="32px" key={pt} color="text" style={{alignItems: "center"}} onClick={() => {
                                                const {wallet, allocations} = allocationsByProductTypes[pt][0];
                                                creationRows[index].productType = pt;
                                                creationRows[index].wallet = wallet;
                                                creationRows[index].allocationId = allocations[0].id;
                                                setCreationRows([...creationRows]);
                                            }}>
                                                <Icon my="4px" mr="8px" name={productTypeToIcon(pt)} />{productTypeToTitle(pt)}
                                            </Flex> :
                                            <Tooltip key={pt} trigger={<Flex height="32px" style={{alignItems: "center"}} color="gray" onClick={stopPropagationAndPreventDefault}>
                                                <Icon mr="8px" name={productTypeToIcon(pt)} />{productTypeToTitle(pt)}</Flex>}>
                                                No allocations for product type available
                                            </Tooltip>
                                    })}
                                </ClickableDropdown></Box>}
                            left={<Flex>
                                <Flex cursor="pointer" onClick={() => selectAllocation(allocationsByProductTypes[row.productType], index)}>
                                    {productAndProvider}<Icon name="chevronDownLight" mt="5px" size="1em" ml=".7em" color={"darkGray"} />
                                </Flex>
                                <Flex color="var(--gray)" ml="12px">
                                    <DatePicker
                                        selectsRange
                                        fontSize="18px"
                                        py="0"
                                        dateFormat="dd/MM/yy"
                                        width="265px"
                                        startDate={new Date(row.startDate)}
                                        isClearable={creationRows[index].endDate != null}
                                        endDate={row.endDate != null ? new Date(row.endDate) : undefined}
                                        onChange={(dates: [Date | null, Date | null]) => {
                                            setCreationRows(rows => {
                                                if (dates[0]) rows[index].startDate = dates[0].getTime();
                                                rows[index].endDate = dates[1]?.getTime();
                                                return [...rows];
                                            });
                                        }}
                                    />
                                </Flex>
                            </Flex>}
                            right={row.wallet == null ? null : <Flex width={["NETWORK_IP", "INGRESS", "LICENSE"].includes(row.productType) ? "330px" : "280px"}>
                                <Input
                                    width="100%"
                                    type="number"
                                    rightLabel
                                    min={0}
                                    placeholder="Amount..."
                                    onChange={e => creationRows[index].amount = normalizeBalanceForBackend(parseInt(e.target.value, 10), row.productType, row.wallet!.chargeType, row.wallet!.unit)}
                                />
                                <InputLabel textAlign="center" width={["INGRESS", "LICENSE"].includes(row.productType) ? "250px" : "78px"} rightLabel>{explainSubAllocation(row.wallet)}</InputLabel>
                                <Icon mt="9px" ml="12px" name="close" color="red" cursor="pointer" onClick={() => removeRow(row.id)} />
                            </Flex>}
                        />);
                })}
                {props.rows.map(row => <SubAllocationRow key={row.id} editEntries={editEntries} editing={editing} suballocation={row} />)}
            </Box>
        </Accordion>, [creationRows, props.rows, props.wallets, loading, allocationsByProductTypes, editing]);
}

function findValidAllocations(wallets: Wallet[], productType: ProductType): {wallet: Wallet, allocations: WalletAllocation[]}[] {
    const now = new Date().getTime();

    return wallets.filter(it => it.productType === productType).flatMap(w => ({
        wallet: w,
        allocations: w.allocations.filter(it =>
            (it.endDate == null || it.endDate < now) &&
            it.localBalance > 0
        )
    }));
}

function hasValidAllocations(walletAllocations?: {wallet: Wallet, allocations: WalletAllocation[]}[]): boolean {
    if (!walletAllocations) return false;
    return walletAllocations.some(({allocations}) => allocations.length > 0);
}

function SubAllocationRow(props: {suballocation: SubAllocation; editing: boolean; editEntries: MutableRefObject<{[id: string]: SubAllocation}>}): JSX.Element {
    const entry = props.suballocation;
    const [dates, setDates] = useState<[number, number | undefined | null]>([entry.startDate, entry.endDate ?? undefined]);
    React.useEffect(() => {
        if (!props.editing) {
            setDates([entry.startDate, entry.endDate]);
        }
    }, [props.editing]);
    if (props.editing) return (
        <ListRow
            key={entry.id}
            icon={<Box pl="20px"><Icon name={productTypeToIcon(entry.productType)} /></Box>}
            left={<Flex>
                <Text>{titleForSubAllocation(entry)}</Text>
                <Flex color="var(--gray)" ml="12px">
                    <Text color="var(--gray)" mt="3px" fontSize="18px">
                        Start date: <DatePicker
                            selectsRange
                            fontSize="18px"
                            py="0"
                            width="265px"
                            paddingLeft={0}
                            dateFormat="dd/MM/yy"
                            isClearable={dates[1] != null}
                            startDate={new Date(dates[0])}
                            endDate={dates[1] != null ? new Date(dates[1]) : undefined}
                            onChange={(dates: [Date, Date | null]) =>
                                setDates(oldDates => {
                                    const firstDate = dates[0] ? dates[0].getTime() : oldDates[0];
                                    const secondDate = dates[1]?.getTime();
                                    props.editEntries.current[entry.id].startDate = firstDate;
                                    props.editEntries.current[entry.id].endDate = secondDate;
                                    return [firstDate, secondDate];
                                })
                            }
                        />
                    </Text>
                </Flex>
            </Flex>}
            right={<Flex width="280px">
                <Input
                    width="100%"
                    type="number"
                    rightLabel
                    min={0}
                    placeholder={normalizeSuballocationBalanceForFrontend(entry)}
                    onChange={e => props.editEntries.current[entry.id].remaining = normalizeBalanceForBackend(parseInt(e.target.value, 10), entry.productType, entry.chargeType, entry.unit)}
                />
                <InputLabel textAlign={"center"} width={["INGRESS", "LICENSE"].includes(entry.productType) ? "250px" : "78px"} rightLabel>{explainSubAllocation(entry)}</InputLabel>
            </Flex>}
        />
    ); else return (
        <ListRow
            key={entry.id}
            icon={<Box pl="20px"><Icon name={productTypeToIcon(entry.productType)} /></Box>}
            left={<Flex>
                <Text>{titleForSubAllocation(entry)}</Text>
                <Text mt="3px" color="var(--gray)" ml="12px" fontSize={"18px"}>Start date: {format(entry.startDate, "dd/MM/yy")}, End date: {entry.endDate ? format(entry.endDate, "dd/MM/yy") : "N/A"}</Text>
            </Flex>}
            right={<>
                {remainingBalance(entry)}
                <Icon ml="12px" name="grant" cursor="pointer" onClick={() => dialogStore.addDialog(<div>TODO</div>, () => undefined, false)} />
            </>}
        />
    );
}

function explainSubAllocation(suballocation: {productType: ProductType; chargeType: ChargeType; unit: ProductPriceUnit}): string {
    return explainAllocation(suballocation.productType, suballocation.chargeType, suballocation.unit);
}

function normalizeSuballocationBalanceForFrontend(suballocation: {remaining: number; productType: ProductType; chargeType: ChargeType; unit: ProductPriceUnit}): string {
    return normalizeBalanceForFrontend(
        suballocation.remaining, suballocation.productType, suballocation.chargeType, suballocation.unit, false, 2
    );
}

function remainingBalance(suballocation: SubAllocation): string {
    return normalizeSuballocationBalanceForFrontend(suballocation) + " " + explainSubAllocation(suballocation);
}

const SearchInput = styled.div`
    position: relative;

    label {
        position: absolute;
        left: 260px;
        top: 10px;
    }
`;
