import * as React from "react";
import {useCallback, useMemo, useState} from "react";
import {IconName} from "@/ui-components/Icon";
import {Box, Button, Divider, Flex, Grid, Icon, Input, Stamp} from "@/ui-components";
import * as Heading from "@/ui-components/Heading";
import * as Text from "@/ui-components/Text";
import ClickableDropdown from "@/ui-components/ClickableDropdown";
import {Cursor} from "@/ui-components/Types";
import styled from "styled-components";
import {ListRow, ListRowStat} from "@/ui-components/List";
import {SlimDatePickerWrapper} from "@/ui-components/DatePicker";
import {enGB} from "date-fns/locale";
import ReactDatePicker from "react-datepicker";
import {Toggle} from "@/ui-components/Toggle";
import {doNothing, timestampUnixMs, useEffectSkipMount} from "@/UtilityFunctions";
import {getStartOfDay, getStartOfMonth, getStartOfWeek} from "@/Utilities/DateUtilities";
import {dateToStringNoTime} from "@/Utilities/DateUtilities";
import {SortEntry} from "@/UCloud/ResourceApi";
import {BrowseType} from "./BrowseType";

export interface FilterWidgetProps {
    properties: Record<string, string>;
    onPropertiesUpdated: (updatedProperties: Record<string, string | undefined>) => void;
    expanded: boolean;
    id: number;
    onExpand: (id: number) => void;
}

export interface PillProps {
    canRemove?: boolean;
    properties: Record<string, string>;
    onDelete: (keys: string[]) => void;
}

function mergeProperties(
    properties: Record<string, string>,
    newProperties: Record<string, string | undefined>,
    setProperties: (p: Record<string, string>) => void
): Record<string, string> {
    const result: Record<string, string> = {...properties};
    for (const [key, value] of Object.entries(newProperties)) {
        if (value === undefined) {
            delete result[key];
        } else {
            result[key] = value;
        }
    }
    setProperties(result);
    return result;
}

export const ResourceFilter: React.FunctionComponent<{
    pills: React.FunctionComponent<PillProps>[];
    browseType: BrowseType;
    filterWidgets: React.FunctionComponent<FilterWidgetProps>[];
    sortEntries: SortEntry[];
    properties: Record<string, string>;
    readOnlyProperties?: Record<string, string>;
    setProperties: (props: Record<string, string>) => void;
    sortDirection: "ascending" | "descending";
    sortColumn?: string;
    onSortUpdated: (direction: "ascending" | "descending", column: string) => void;
    onApplyFilters: () => void;
}> = props => {
    const {properties, setProperties} = props;
    const [expanded, setExpanded] = useState<number | null>(null);
    const [sortProperties, setSortProperties] = useState<Record<string, string>>({});
    const [isDirty, setIsDirty] = useState(false);
    const combinedProperties = useMemo(
        () => ({...(props.readOnlyProperties ?? {}), ...properties}),
        [props.readOnlyProperties, properties]
    );

    useEffectSkipMount(() => {
        setIsDirty(true)
    }, [properties, setIsDirty]);

    const onSortDeleted = useCallback((keys: string[]) => {
        const result: Record<string, string> = {...(sortProperties)};
        for (const key of keys) {
            delete result[key];
        }

        setSortProperties(result);
        setIsDirty(true);
    }, [setSortProperties, sortProperties, setIsDirty]);

    const onPillDeleted = useCallback((keys: string[]) => {
        const result: Record<string, string> = {...(properties)};
        for (const key of keys) {
            delete result[key];
        }

        setProperties(result);
        setExpanded(null);
        setIsDirty(true);
    }, [setProperties, setExpanded, properties, setIsDirty]);

    const onPropertiesUpdated = useCallback((updatedProperties: Record<string, string | undefined>) => {
        mergeProperties(properties, updatedProperties, setProperties);
        setIsDirty(true);
    }, [setProperties, properties, setIsDirty]);

    const onSortUpdated = useCallback((updatedProperties: Record<string, string | undefined>) => {
        const newProps = mergeProperties(sortProperties, updatedProperties, setSortProperties);
        props.onSortUpdated(newProps["direction"] as "ascending" | "descending", newProps["column"]);
        setIsDirty(true);
    }, [setSortProperties, sortProperties, setIsDirty, props.onSortUpdated]);

    const sortOptions = useMemo(() =>
        props.sortEntries.map(it => ({
            icon: it.icon,
            title: it.title,
            value: it.column,
            helpText: it.helpText
        })),
        [props.sortEntries]
    );

    const expand = useCallback((id: number) => {
        if (expanded === id) {
            setExpanded(null);
        } else {
            setExpanded(id);
        }
    }, [expanded, setExpanded]);

    const applyFilters = useCallback(() => {
        props.onApplyFilters();
        setIsDirty(false);
    }, [props.onApplyFilters, setIsDirty, sortProperties]);

    const onlyFilter = props.sortEntries.length === 0;

    const isEmbedded = props.browseType === BrowseType.Embedded;

    return <>
        {isEmbedded ? null : <Heading.h4 mt={"32px"} mb={"16px"}>
            <Icon name={"filterSolid"} size={"16px"} mr={"8px"} />
            {onlyFilter ? "Filter" : "Sort and filter"}
        </Heading.h4>}
        <Grid gridGap={"8px"}>
            <WidgetWrapper embedded={isEmbedded} gridGap="12px">
                <EnumPill propertyName={"column"} properties={sortProperties} onDelete={onSortDeleted}
                    icon={"properties"} title={"Sort by"} options={sortOptions} />
                {props.pills.map((Pill, idx) =>
                    <Pill key={Pill.displayName + "_" + idx} properties={combinedProperties} onDelete={onPillDeleted} />
                )}
            </WidgetWrapper>
            {!isDirty ? null :
                <Button color="green" size="small" onClick={applyFilters} mb={"10px"}>
                    <Icon name="check" mr="8px" size="14px" />
                    <Text.TextSpan fontSize="14px">Apply</Text.TextSpan>
                </Button>
            }
        </Grid>
        <Grid gridGap={isEmbedded ? "8px" : "20px"}
            mt={Object.keys(sortProperties).length === 0 && Object.keys(properties).length === 0 ? null : "20px"}>

            {onlyFilter ? null : <>
                <WidgetWrapper embedded={isEmbedded} gridGap="12px">
                    <EnumFilterWidget
                        propertyName="column" icon="properties" title="Sort by" expanded={false}
                        id={0} onExpand={doNothing} properties={sortProperties} onPropertiesUpdated={onSortUpdated}
                        options={sortOptions}
                    />
                </WidgetWrapper>

                {isEmbedded ? null : <Divider />}
            </>}

            <WidgetWrapper embedded={isEmbedded} gridGap="12px">
                {props.filterWidgets.map((Widget, idx) =>
                    <Widget id={idx} key={Widget.displayName + "_" + idx} properties={properties}
                        onPropertiesUpdated={onPropertiesUpdated} onExpand={expand} expanded={expanded == idx} />
                )}
            </WidgetWrapper>
        </Grid>
    </>;
};

function WidgetWrapper({children, embedded, gridGap}: React.PropsWithChildren<{embedded?: boolean, gridGap: string}>): JSX.Element {
    return !embedded ?
        <>{children}</> : (
            <Grid style={{gridAutoFlow: "column", gridGap, gridAutoColumns: "1fr"}}>
                {children}
            </Grid>
        )
}

export const FilterPill: React.FunctionComponent<{
    icon: IconName;
    onRemove: () => void;
    canRemove?: boolean;
}> = ({icon, onRemove, canRemove, children}) => {
    return <Stamp fullWidth onClick={canRemove ? onRemove : undefined} icon={icon} color={"lightBlue"}>
        {children}
    </Stamp>;
};

interface BaseFilterWidgetProps {
    icon: IconName;
    title: string;
}

const FilterWidgetWrapper = styled(Box)`
    display: flex;
    align-items: center;
    user-select: none;
`;

export const FilterWidget: React.FunctionComponent<{
    cursor?: Cursor;
    onClick?: () => void;
} & BaseFilterWidgetProps> = props => {
    return <FilterWidgetWrapper cursor={props.cursor} onClick={props.onClick}>
        <Icon name={props.icon} size={"16px"} color={"iconColor"} color2={"iconColor2"} mr={"8px"} />
        <b>{props.title}</b>
        {props.children}
    </FilterWidgetWrapper>
};

export const ExpandableFilterWidget: React.FunctionComponent<{
    expanded: boolean;
    onExpand: () => void;
} & BaseFilterWidgetProps> = props => {
    return <div>
        <FilterWidget icon={props.icon} title={props.title} onClick={props.onExpand} cursor={"pointer"}>
            <Box flexGrow={1} />
            <Icon name={"chevronDownLight"} rotation={props.expanded ? 0 : 270} size={"16px"} color={"iconColor"} />
        </FilterWidget>
        {!props.expanded ? null : props.children}
    </div>;
};

export const ExpandableDropdownFilterWidget: React.FunctionComponent<{
    expanded: boolean;
    dropdownContent: React.ReactElement;
    onExpand: () => void;
    contentWidth?: string;
    facedownChevron?: boolean;
} & BaseFilterWidgetProps> = props => {
    const trigger = <FilterWidget icon={props.icon} title={props.title} cursor={"pointer"}
        onClick={props.expanded ? props.onExpand : undefined}>
        <Box flexGrow={1} />
        <Icon name={"chevronDownLight"} rotation={props.expanded || props.facedownChevron ? 0 : 270} size={"16px"}
            color={"iconColor"} />
    </FilterWidget>;

    return <div>
        {!props.expanded ?
            <ClickableDropdown
                fullWidth
                trigger={trigger}
                width={props.contentWidth}
                useMousePositioning
                paddingControlledByContent
            >
                {props.dropdownContent}
            </ClickableDropdown> :
            trigger
        }

        {!props.expanded ? null : props.children}
    </div>;
};

export const TextPill: React.FunctionComponent<{
    propertyName: string;
} & PillProps & BaseFilterWidgetProps> = props => {
    const onRemove = useCallback(() => {
        props.onDelete([props.propertyName]);
    }, [props.onDelete, props.propertyName]);

    const value = props.properties[props.propertyName];
    if (!value) return null;

    return <FilterPill icon={props.icon} onRemove={onRemove} canRemove={props.canRemove}>
        {props.title}: {value}
    </FilterPill>;
};

export const TextFilterWidget: React.FunctionComponent<{
    propertyName: string
} & BaseFilterWidgetProps & FilterWidgetProps> = props => {
    const onExpand = useCallback(() => props.onExpand(props.id), [props.onExpand, props.id]);
    const currentValue = props.properties[props.propertyName] ?? "";
    const onChange = useCallback((e: React.SyntheticEvent) => {
        const newValue = (e.target as HTMLInputElement).value;
        const properties: Record<string, string | undefined> = {};
        properties[props.propertyName] = newValue === "" ? undefined : newValue;
        props.onPropertiesUpdated(properties);
    }, [props.onPropertiesUpdated, props.propertyName]);
    return <ExpandableFilterWidget expanded={props.expanded} icon={props.icon} title={props.title} onExpand={onExpand}>
        <Input autoFocus value={currentValue} onChange={onChange} />
    </ExpandableFilterWidget>;
};

export function TextFilter(
    icon: IconName,
    propertyName: string,
    title: string
): [React.FunctionComponent<FilterWidgetProps>, React.FunctionComponent<PillProps>] {
    return [
        (props) => <TextFilterWidget propertyName={propertyName} icon={icon} title={title} {...props} />,
        (props) => <TextPill propertyName={propertyName} icon={icon} title={title} {...props} />
    ];
}

export const DateRangePill: React.FunctionComponent<{
    beforeProperty: string;
    afterProperty: string
} & PillProps & BaseFilterWidgetProps> = props => {
    const onRemove = useCallback(() => {
        props.onDelete([props.beforeProperty, props.afterProperty]);
    }, [props.onDelete, props.beforeProperty, props.afterProperty]);

    const after = props.properties[props.afterProperty];
    if (!after) return null;

    const before = props.properties[props.beforeProperty];

    return <>
        <FilterPill icon={props.icon} onRemove={onRemove} canRemove={props.canRemove}>
            {before ?
                <>
                    {props.title} between: {dateToStringNoTime(parseInt(after))} - {dateToStringNoTime(parseInt(before))}
                </> :
                <>
                    {props.title} after: {dateToStringNoTime(parseInt(after))}
                </>
            }
        </FilterPill>
    </>;
};

const DateRangeEntry: React.FunctionComponent<{title: string; range: string; onClick?: () => void}> = props => {
    return <ListRow
        select={props.onClick}
        fontSize={"16px"}
        icon={<Icon name={"calendar"} size={"20px"} ml={"16px"} />}
        left={props.title}
        leftSub={<ListRowStat>{props.range}</ListRowStat>}
        right={null}
        stopPropagation={false}
    />;
};

export const DateRangeFilterWidget: React.FunctionComponent<{
    beforeProperty: string;
    afterProperty: string
} & BaseFilterWidgetProps & FilterWidgetProps> = props => {
    const onExpand = useCallback(() => props.onExpand(props.id), [props.onExpand, props.id]);
    const [isSelectingRange, setIsSelectingRange] = useState(false);
    const toggleIsSelectingRange = useCallback(() => setIsSelectingRange(prev => !prev), [setIsSelectingRange]);
    const createdAfter = props.properties[props.afterProperty] ?? getStartOfDay(new Date()).getTime();
    const createdBefore = props.properties[props.beforeProperty];

    const updateDates = useCallback((dates: [Date, Date] | Date) => {
        if (Array.isArray(dates)) {
            const [start, end] = dates;
            const newCreatedAfter = start.getTime();
            const newCreatedBefore = end?.getTime();
            const newProps: Record<string, string> = {};
            newProps[props.afterProperty] = newCreatedAfter.toString();
            newProps[props.beforeProperty] = newCreatedBefore?.toString() ?? undefined;
            props.onPropertiesUpdated(newProps);
        } else {
            const newCreatedAfter = dates.getTime();
            const newProps: Record<string, string | undefined> = {};
            newProps[props.afterProperty] = newCreatedAfter.toString();
            newProps[props.beforeProperty] = undefined;
            props.onPropertiesUpdated(newProps);
        }
    }, [props.beforeProperty, props.afterProperty, props.onPropertiesUpdated]);

    const todayMs = getStartOfDay(new Date(timestampUnixMs())).getTime();
    const yesterdayEnd = todayMs - 1;
    const yesterdayStart = getStartOfDay(new Date(todayMs - 1)).getTime();
    const lastWeekEnd = getStartOfWeek(new Date(todayMs)).getTime() - 1;
    const lastWeekStart = getStartOfWeek(new Date(lastWeekEnd)).getTime();
    const lastMonthEnd = getStartOfMonth(new Date()).getTime() - 1;
    const lastMonthStart = getStartOfMonth(new Date(lastMonthEnd)).getTime();

    return <ExpandableDropdownFilterWidget
        expanded={props.expanded}
        contentWidth={"300px"}
        dropdownContent={
            <>
                <DateRangeEntry
                    title={"Today"}
                    range={dateToStringNoTime(todayMs)}
                    onClick={() => {
                        updateDates(new Date(todayMs));
                    }}
                />
                <DateRangeEntry
                    title={"Yesterday"}
                    range={`${dateToStringNoTime(yesterdayStart)}`}
                    onClick={() => {
                        updateDates([new Date(yesterdayStart), new Date(yesterdayEnd)]);
                    }}
                />
                <DateRangeEntry
                    title={"Last week"}
                    range={`${dateToStringNoTime(lastWeekStart)} - ${dateToStringNoTime(lastWeekEnd)}`}
                    onClick={() => {
                        updateDates([new Date(lastWeekStart), new Date(lastWeekEnd)]);
                    }}
                />
                <DateRangeEntry
                    title={"Last month"}
                    range={`${dateToStringNoTime(lastMonthStart)} - ${dateToStringNoTime(lastMonthEnd)}`}
                    onClick={() => {
                        updateDates([new Date(lastMonthStart), new Date(lastMonthEnd)]);
                    }}
                />
                <DateRangeEntry
                    title={"Custom"}
                    range={"Enter your own period"}
                    onClick={onExpand}
                />
            </>
        }
        onExpand={onExpand}
        icon={props.icon}
        title={props.title}>
        <Flex mt={"8px"} mb={"16px"}>
            <Box flexGrow={1} cursor={"pointer"} onClick={toggleIsSelectingRange}>Filter by period</Box>
            <Toggle onChange={toggleIsSelectingRange} checked={isSelectingRange} />
        </Flex>

        {isSelectingRange ? "Created between:" : "Created after:"}
        <SlimDatePickerWrapper>
            <ReactDatePicker
                locale={enGB}
                startDate={new Date(parseInt(createdAfter))}
                endDate={createdBefore ? new Date(parseInt(createdBefore)) : undefined}
                onChange={updateDates}
                selectsRange={isSelectingRange}
                inline
                dateFormat="dd/MM/yy HH:mm"
            />
        </SlimDatePickerWrapper>
    </ExpandableDropdownFilterWidget>
}

export function DateRangeFilter(
    icon: IconName,
    title: string,
    beforeProperty: string,
    afterProperty: string
): [React.FunctionComponent<FilterWidgetProps>, React.FunctionComponent<PillProps>] {
    return [
        (props) => <DateRangeFilterWidget beforeProperty={beforeProperty} afterProperty={afterProperty}
            icon={icon} title={title} {...props} />,
        (props) => <DateRangePill beforeProperty={beforeProperty} afterProperty={afterProperty}
            icon={icon} title={title} {...props} />,
    ];
}

export const ValuePill: React.FunctionComponent<{
    propertyName: string;
    showValue: boolean;
    secondaryProperties?: string[];
    valueToString?: (value: string) => string;
} & PillProps & BaseFilterWidgetProps> = (props) => {
    const onRemove = useCallback(() => {
        const allProperties = [...(props.secondaryProperties ?? [])];
        allProperties.push(props.propertyName);
        props.onDelete(allProperties);
    }, [props.secondaryProperties, props.onDelete, props.propertyName]);

    const value = props.properties[props.propertyName];
    if (!value) return null;

    return <FilterPill icon={props.icon} onRemove={onRemove} canRemove={props.canRemove}>
        {props.title}
        {props.title.length > 0 && (props.showValue || props.children) ? ": " : null}
        {!props.showValue ? null : props.valueToString ? props.valueToString(value) : value}
        {props.children}
    </FilterPill>;
};

export interface EnumOption {
    icon?: IconName;
    value: string;
    title: string;
    helpText?: string;
}

interface EnumOptions {
    options: EnumOption[];
}

export const EnumPill: React.FunctionComponent<{
    propertyName: string;
} & PillProps & BaseFilterWidgetProps & EnumOptions> = props => {
    const onRemove = useCallback(() => {
        props.onDelete([props.propertyName]);
    }, [props.onDelete, props.propertyName]);

    const value = props.properties[props.propertyName];
    if (!value) return null;

    return <FilterPill icon={props.icon} onRemove={onRemove} canRemove={props.canRemove}>
        {props.title}: {props.options.find(it => it.value === value)?.title ?? value}
    </FilterPill>;
};

export const EnumFilterWidget: React.FunctionComponent<{
    propertyName: string;
    facedownChevron?: boolean;
} & BaseFilterWidgetProps & FilterWidgetProps & EnumOptions> = props => {
    const onChange = useCallback((newValue: string) => {
        const properties: Record<string, string | undefined> = {};
        properties[props.propertyName] = newValue === "" ? undefined : newValue;
        props.onPropertiesUpdated(properties);
    }, [props.onPropertiesUpdated, props.propertyName]);

    return <ExpandableDropdownFilterWidget
        expanded={props.expanded}
        icon={props.icon}
        title={props.title}
        onExpand={doNothing}
        facedownChevron={props.facedownChevron}
        contentWidth={"300px"}
        dropdownContent={
            <>
                {props.options.map(opt =>
                    <ListRow
                        key={opt.value}
                        icon={!opt.icon ? null :
                            <Icon name={opt.icon} color={"iconColor"} color2={"iconColor2"} size={"16px"} ml={"16px"} />
                        }
                        left={opt.title}
                        leftSub={opt.helpText ? <ListRowStat>{opt.helpText}</ListRowStat> : null}
                        right={null}
                        fontSize={"16px"}
                        select={() => onChange(opt.value)}
                        stopPropagation={false}
                    />
                )}
            </>
        }
    />
};

export function EnumFilter(
    icon: IconName,
    propertyName: string,
    title: string,
    options: EnumOption[]
): [React.FunctionComponent<FilterWidgetProps>, React.FunctionComponent<PillProps>] {
    return [
        (props) => <EnumFilterWidget options={options} propertyName={propertyName} icon={icon}
            title={title} {...props} />,
        (props) => <EnumPill options={options} propertyName={propertyName} icon={icon} title={title} {...props} />
    ];
}

export const CheckboxPill: React.FunctionComponent<{
    propertyName: string;
    invert?: boolean;
} & PillProps & BaseFilterWidgetProps> = props => {
    const onRemove = useCallback(() => {
        props.onDelete([props.propertyName]);
    }, [props.onDelete, props.propertyName]);

    const value = props.properties[props.propertyName];
    if (!value) return null;
    let isChecked = value === "true";
    if (props.invert === true) {
        isChecked = !isChecked;
    }

    return <FilterPill icon={props.icon} onRemove={onRemove} canRemove={props.canRemove}>
        {props.title}: {isChecked ? "Yes" : "No"}
    </FilterPill>;
};

export const CheckboxFilterWidget: React.FunctionComponent<{
    propertyName: string;
    invert?: boolean;
} & BaseFilterWidgetProps & FilterWidgetProps> = props => {
    const isTrue = props.properties[props.propertyName] === "true";
    const isChecked = props.invert === true ? !isTrue : isTrue;

    const onChange = useCallback(() => {
        const properties: Record<string, string | undefined> = {};
        properties[props.propertyName] = (!isTrue).toString();
        props.onPropertiesUpdated(properties);
    }, [isTrue, props.onPropertiesUpdated, props.propertyName]);

    return (
        <Flex>
            <Box mt="-3px">
                <FilterWidget
                    icon={props.icon}
                    title={props.title}
                    cursor="pointer"
                    onClick={onChange}
                />
            </Box>
            <Box flexGrow={1} />
            <Toggle onChange={onChange} checked={isChecked} />
        </Flex>
    );
}

export function CheckboxFilter(
    icon: IconName,
    propertyName: string,
    title: string,
    invert?: boolean
): [React.FunctionComponent<FilterWidgetProps>, React.FunctionComponent<PillProps>] {
    return [
        (props) => <CheckboxFilterWidget propertyName={propertyName} icon={icon} title={title} invert={invert} {...props} />,
        (props) => <CheckboxPill propertyName={propertyName} icon={icon} title={title} invert={invert} {...props} />
    ];
}