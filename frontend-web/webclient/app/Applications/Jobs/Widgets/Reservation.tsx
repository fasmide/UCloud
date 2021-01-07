import * as React from "react";
import * as UCloud from "UCloud";
import {Box, Flex, Input, Label} from "ui-components";
import {TextP} from "ui-components/Text";
import {
    Machines,
    setMachineReservationFromRef,
    validateMachineReservation
} from "Applications/Jobs/Widgets/Machines";
import {useCallback, useEffect, useState} from "react";
import {useCloudAPI} from "Authentication/DataHook";
import {useProjectId} from "Project";
import {MandatoryField} from "Applications/Jobs/Widgets/index";

const reservationName = "reservation-name";
const reservationHours = "reservation-hours";
const reservationMinutes = "reservation-minutes";
const reservationReplicas = "reservation-replicas";

export const ReservationParameter: React.FunctionComponent<{
    application: UCloud.compute.Application;
    errors: ReservationErrors;
    onEstimatedCostChange?: (cost: number, balance: number) => void;
}> = ({application, errors, onEstimatedCostChange}) => {
    // Estimated cost
    const [selectedMachine, setSelectedMachine] = useState<UCloud.accounting.ProductNS.Compute | null>(null);
    const [wallet, fetchWallet] = useCloudAPI<UCloud.accounting.RetrieveBalanceResponse>({noop: true}, {wallets: []});
    const balance = wallet.data.wallets.find(it =>
        it.area === "COMPUTE" &&
        it.wallet.paysFor.id === selectedMachine?.category.id &&
        it.wallet.paysFor.provider === selectedMachine.category.provider
    )?.balance ?? 0;

    const projectId = useProjectId();
    useEffect(() => {
        fetchWallet(UCloud.accounting.wallets.retrieveBalance({}));
    }, [projectId]);

    const recalculateCost = useCallback(() => {
        const {options} = validateReservation();
        if (options != null && options.timeAllocation != null) {
            const pricePerUnit = selectedMachine?.pricePerUnit ?? 0;
            const estimatedCost =
                (options.timeAllocation.hours * 60 * pricePerUnit +
                (options.timeAllocation.minutes * pricePerUnit)) * options.replicas;
            if (onEstimatedCostChange) onEstimatedCostChange(estimatedCost, balance);
        }
    }, [selectedMachine, balance, onEstimatedCostChange]);

    useEffect(() => {
        recalculateCost();
    }, [selectedMachine]);

    return <Box>
        <Label mb={"4px"}>
            Job name
            <Input
                id={reservationName}
                placeholder={"Example: Run with parameters XYZ"}
            />
            {errors["name"] ? <TextP color={"red"}>{errors["name"]}</TextP> : null}
        </Label>

        <Flex mb={"1em"}>
            <Label>
                Hours <MandatoryField/>
                <Input
                    id={reservationHours}
                    onBlur={recalculateCost}
                    defaultValue={application.invocation.tool.tool?.description?.defaultTimeAllocation?.hours ?? 1}
                />
            </Label>
            <Box ml="4px"/>
            <Label>
                Minutes <MandatoryField/>
                <Input
                    id={reservationMinutes}
                    onBlur={recalculateCost}
                    defaultValue={application.invocation.tool.tool?.description?.defaultTimeAllocation?.minutes ?? 0}
                />
            </Label>
        </Flex>
        {errors["timeAllocation"] ? <TextP color={"red"}>{errors["timeAllocation"]}</TextP> : null}

        {!application.invocation.allowMultiNode ? null : (
            <>
                <Flex mb={"1em"}>
                    <Label>
                        Number of replicas
                        <Input id={reservationReplicas} onBlur={recalculateCost}/>
                    </Label>
                </Flex>
                {errors["replicas"] ? <TextP color={"red"}>{errors["replicas"]}</TextP> : null}
            </>
        )}

        <div>
            <Label>Machine type <MandatoryField/></Label>
            <Machines onMachineChange={setSelectedMachine}/>
            {errors["product"] ? <TextP color={"red"}>{errors["product"]}</TextP> : null}
        </div>
    </Box>
};

export type ReservationValues = Pick<UCloud.compute.JobParameters, "name" | "timeAllocation" | "replicas" | "product">;

interface ValidationAnswer {
    options?: ReservationValues;
    errors: ReservationErrors;
}

export type ReservationErrors = {
    [P in keyof ReservationValues]?: string;
}

export function validateReservation(): ValidationAnswer {
    const name = document.getElementById(reservationName) as HTMLInputElement | null;
    const hours = document.getElementById(reservationHours) as HTMLInputElement | null;
    const minutes = document.getElementById(reservationMinutes) as HTMLInputElement | null;
    const replicas = document.getElementById(reservationReplicas) as HTMLInputElement | null;

    if (name === null || hours === null || minutes === null) throw "Reservation component not mounted";

    const values: Partial<ReservationValues> = {};
    const errors: ReservationErrors = {};
    if (hours.value === "") {
        errors["timeAllocation"] = "Missing value supplied for hours";
    } else if (minutes.value === "") {
        errors["timeAllocation"] = "Missing value supplied for minutes";
    } else if (!/^\d+$/.test(hours.value)) {
        errors["timeAllocation"] = "Invalid value supplied for hours. Example: 1";
    } else if (!/^\d+$/.test(minutes.value)) {
        errors["timeAllocation"] = "Invalid value supplied for minutes. Example: 0";
    }

    if (!errors["timeAllocation"]) {
        const parsedHours = parseInt(hours.value, 10);
        const parsedMinutes = parseInt(minutes.value, 10);

        values["timeAllocation"] = {
            hours: parsedHours,
            minutes: parsedMinutes,
            seconds: 0
        };
    }

    values["name"] = name.value === "" ? undefined : name.value;

    if (replicas != null) {
        if (!/^\d+$/.test(replicas.value)) {
            errors["replicas"] = "Invalid value supplied for replicas. Example: 1";
        }

        values["replicas"] = parseInt(replicas.value, 10);
    } else {
        values["replicas"] = 1;
    }

    const machineReservation = validateMachineReservation();
    if (machineReservation === null) {
        errors["product"] = "No machine type selected";
    } else {
        values["product"] = machineReservation;
    }

    return {
        options: Object.keys(errors).length > 0 ? undefined : values as ReservationValues,
        errors
    };
}

export function setReservation(values: Partial<ReservationValues>): void {
    const name = document.getElementById(reservationName) as HTMLInputElement | null;
    const hours = document.getElementById(reservationHours) as HTMLInputElement | null;
    const minutes = document.getElementById(reservationMinutes) as HTMLInputElement | null;
    const replicas = document.getElementById(reservationReplicas) as HTMLInputElement | null;

    if (name === null || hours === null || minutes === null) throw "Reservation component not mounted";

    name.value = values.name ?? "";
    hours.value = values.timeAllocation?.hours?.toString(10) ?? "";
    minutes.value = values.timeAllocation?.minutes?.toString(10) ?? "";
    if (replicas != null && values.replicas !== undefined) replicas.value = values.replicas.toString(10)

    if (values.product !== undefined) setMachineReservationFromRef(values.product);
}