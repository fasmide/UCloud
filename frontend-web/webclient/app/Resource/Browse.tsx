import * as React from "react";
import {PropsWithChildren, ReactElement, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    ResolvedSupport,
    Resource,
    ResourceApi,
    ResourceBrowseCallbacks,
    ResourceStatus,
    ResourceUpdate,
    SupportByProvider,
    ResourceSpecification,
    UCLOUD_CORE
} from "@/UCloud/ResourceApi";
import {useCloudAPI, useCloudCommand} from "@/Authentication/DataHook";
import {bulkRequestOf} from "@/DefaultObjects";
import {useLoading, useTitle} from "@/Navigation/Redux/StatusActions";
import {useToggleSet} from "@/Utilities/ToggleSet";
import {PageRenderer} from "@/Pagination/PaginationV2";
import {Box, Checkbox, Flex, Icon, Label, List, Truncate} from "@/ui-components";
import {Spacer} from "@/ui-components/Spacer";
import {ListRowStat} from "@/ui-components/List";
import {Operations} from "@/ui-components/Operation";
import {dateToString} from "@/Utilities/DateUtilities";
import MainContainer from "@/MainContainer/MainContainer";
import {NamingField} from "@/UtilityComponents";
import {ProductSelector} from "@/Resource/ProductSelector";
import {doNothing, preventDefault, timestampUnixMs, useEffectSkipMount} from "@/UtilityFunctions";
import {Client} from "@/Authentication/HttpClientInstance";
import {useSidebarPage} from "@/ui-components/Sidebar";
import * as Heading from "@/ui-components/Heading";
import {useHistory, useLocation} from "react-router";
import {EnumOption, ResourceFilter, StaticPill} from "@/Resource/Filter";
import {useResourceSearch} from "@/Resource/Search";
import {getQueryParamOrElse} from "@/Utilities/URIUtilities";
import {useDispatch} from "react-redux";
import * as H from "history";
import {ItemRenderer, ItemRow, StandardBrowse, useRenamingState} from "@/ui-components/Browse";
import {useAvatars} from "@/AvataaarLib/hook";
import {Avatar} from "@/AvataaarLib";
import {defaultAvatar} from "@/UserSettings/Avataaar";
import {Product, ProductType, productTypeToIcon} from "@/Accounting";
import {EnumFilterWidget} from "@/Resource/Filter";
import {BrowseType} from "./BrowseType";
import {snackbarStore} from "@/Snackbar/SnackbarStore";
import {useProjectId, useProjectManagementStatus} from "@/Project";
import {isAdminOrPI} from "@/Utilities/ProjectUtilities";

export interface ResourceBrowseProps<Res extends Resource, CB> extends BaseResourceBrowseProps<Res> {
    api: ResourceApi<Res, never>;

    onInlineCreation?: (text: string, product: Product, cb: ResourceBrowseCallbacks<Res> & CB) => Res["specification"] | APICallParameters;
    inlinePrefix?: (productWithSupport: ResolvedSupport) => string;
    inlineSuffix?: (productWithSupport: ResolvedSupport) => string;
    inlineCreationMode?: "TEXT" | "NONE";
    inlineProduct?: Product;
    productFilterForCreate?: (product: ResolvedSupport) => boolean;

    additionalFilters?: Record<string, string>;
    header?: JSX.Element;
    headerSize?: number;
    onRename?: (text: string, resource: Res, cb: ResourceBrowseCallbacks<Res>) => Promise<void>;

    navigateToChildren?: (history: H.History, resource: Res) => "properties" | void;
    emptyPage?: JSX.Element;
    propsForInlineResources?: Record<string, any>;
    extraCallbacks?: any;

    viewPropertiesInline?: (res: Res) => boolean;

    withDefaultStats?: boolean;
    showCreatedAt?: boolean;
    showCreatedBy?: boolean;
    showProduct?: boolean;
    showGroups?: boolean;

    onResourcesLoaded?: (newItems: Res[]) => void;
    shouldFetch?: () => boolean;

    extraSidebar?: JSX.Element;
}

export interface BaseResourceBrowseProps<Res extends Resource> {
    browseType: BrowseType;
    isSearch?: boolean;

    onSelect?: (resource: Res) => void;
    onSelectRestriction?: (resource: Res) => boolean;
}

function getStoredSortDirection(title: string): "ascending" | "descending" | null {
    return localStorage.getItem(`${title}:sortDirection`) as "ascending" | "descending" | null;
}

function getStoredSortColumn(title: string): string | null {
    return localStorage.getItem(`${title}:sortColumn`);
}

function setStoredSortColumn(title: string, column?: string): void {
    if (column) localStorage.setItem(`${title}:sortColumn`, column);
}
function setStoredSortDirection(title: string, order: "ascending" | "descending"): void {
    localStorage.setItem(`${title}:sortDirection`, order);
}

export function ResourceBrowse<Res extends Resource, CB = undefined>({
    onSelect, api, ...props
}: PropsWithChildren<ResourceBrowseProps<Res, CB>> & {/* HACK(Jonas) */disableSearch?: boolean/* HACK(Jonas): End */}): ReactElement | null {
    const [productsWithSupport, fetchProductsWithSupport] = useCloudAPI<SupportByProvider>(
        {noop: true},
        {productsByProvider: {}}
    );

    const isEmbedded = props.browseType === BrowseType.Embedded;
    const includeOthers = props.browseType !== BrowseType.Embedded;
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(props.inlineProduct ?? null);
    const [renamingValue, setRenamingValue] = useState("");
    const [commandLoading, invokeCommand] = useCloudCommand();
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [sortDirection, setSortDirection] = useState<"ascending" | "descending">(getStoredSortDirection(api.title) ?? api.defaultSortDirection);
    const [sortColumn, setSortColumn] = useState<string | undefined>(getStoredSortColumn(api.title) ?? undefined);
    const history = useHistory();
    const location = useLocation();
    const query = getQueryParamOrElse(location.search, "q", "");

    const reloadRef = useRef<() => void>(doNothing);
    const toggleSet = useToggleSet<Res>([]);
    const scrollingContainerRef = useRef<HTMLDivElement>(null);
    // Bug(Jonas): Causing rerenders on scrolling for modal showing properties.
    // const scrollStatus = useScrollStatus(scrollingContainerRef, true);
    const [isCreating, setIsCreating] = useState(false);
    const dispatch = useDispatch();
    const projectId = useProjectId();
    const projectManagement = useProjectManagementStatus({
        isRootComponent: props.browseType == BrowseType.MainContent,
        allowPersonalProject: true
    });
    const isWorkspaceAdmin = projectId === undefined ? true : isAdminOrPI(projectManagement.projectRole);

    useEffect(() => toggleSet.uncheckAll(), [props.additionalFilters]);

    const [inlineInspecting, setInlineInspecting] = useState<Res | null>(null);
    const closeProperties = useCallback(() => setInlineInspecting(null), [setInlineInspecting]);
    useEffect(() => fetchProductsWithSupport(api.retrieveProducts()), []);
    const renaming = useRenamingState<Res>(
        () => renamingValue, [renamingValue],
        (a, b) => a.id === b.id, [],

        async (item, text) => {
            await props.onRename?.(text, item, callbacks);
            callbacks.reload();
        },
        [props.onRename]
    );

    const sortDirections: EnumOption[] = [{
        icon: "sortAscending",
        title: "Ascending",
        value: "ascending",
        helpText: "Increasing in value, e.g. 1, 2, 3..."
    }, {
        icon: "sortDescending",
        title: "Descending",
        value: "descending",
        helpText: "Decreasing in value, e.g. 3, 2, 1..."
    }];

    const products: Product[] = useMemo(() => {
        const allProducts: Product[] = [];
        for (const provider of Object.keys(productsWithSupport.data.productsByProvider)) {
            const productsByProvider = productsWithSupport.data.productsByProvider[provider];
            if (!productsByProvider) continue;
            for (const productWithSupport of productsByProvider) {
                if (props.productFilterForCreate !== undefined && !props.productFilterForCreate(productWithSupport)) {
                    continue;
                }

                allProducts.push(productWithSupport.product as unknown as Product);
            }
        }
        return allProducts;
    }, [productsWithSupport, props.productFilterForCreate]);

    const selectedProductWithSupport: ResolvedSupport | null = useMemo(() => {
        if (selectedProduct) {
            const productsByProvider = productsWithSupport.data.productsByProvider[selectedProduct.category.provider]
            if (productsByProvider) {
                return productsByProvider.find(it =>
                    it.product.name === selectedProduct.name &&
                    it.product.category.name === selectedProduct.category.name
                ) ?? null;
            }
        }
        return null;
    }, [selectedProduct, productsWithSupport]);

    const generateFetch = useCallback((next?: string): APICallParameters => {
        if (props.shouldFetch && !props.shouldFetch()) {
            return {noop: true};
        }

        if (props.isSearch) {
            return api.search({
                itemsPerPage: 100, flags: {includeOthers, ...filters}, query,
                next, sortDirection, sortBy: sortColumn, ...props.additionalFilters
            });
        } else {
            return api.browse({
                next, itemsPerPage: 100, includeOthers,
                ...filters, sortBy: sortColumn, sortDirection, ...props.additionalFilters
            });
        }
    }, [filters, query, props.isSearch, sortColumn, sortDirection, props.additionalFilters, props.shouldFetch]);

    useEffectSkipMount(() => {
        setSelectedProduct(props.inlineProduct ?? null);
    }, [props.inlineProduct]);

    const viewProperties = useCallback((res: Res) => {
        if (isEmbedded && (props.viewPropertiesInline === undefined || props.viewPropertiesInline(res))) {
            setInlineInspecting(res);
        } else {
            history.push(`/${api.routingNamespace}/properties/${encodeURIComponent(res.id)}`);
        }
    }, [setInlineInspecting, isEmbedded, history, api, props.viewPropertiesInline]);

    const callbacks: ResourceBrowseCallbacks<Res> & CB = useMemo(() => ({
        api,
        isCreating,
        invokeCommand,
        commandLoading,
        reload: () => {
            toggleSet.uncheckAll();
            reloadRef.current()
        },
        embedded: isEmbedded,
        onSelect,
        onSelectRestriction: props.onSelectRestriction,
        dispatch,
        history,
        isWorkspaceAdmin,
        startRenaming(res: Res, value: string) {
            renaming.setRenaming(res);
            setRenamingValue(value);
        },
        startCreation() {
            if (props.onInlineCreation != null) {
                setSelectedProduct(props.inlineProduct ?? null);
                setIsCreating(true);
            }
        },
        cancelCreation() {
            setIsCreating(false);
        },
        viewProperties,
        ...props.extraCallbacks,
        supportByProvider: productsWithSupport.data
    }), [api, invokeCommand, commandLoading, reloadRef, isCreating, props.onInlineCreation, history, dispatch,
        viewProperties, props.inlineProduct, props.extraCallbacks, toggleSet, productsWithSupport.data]);

    const onProductSelected = useCallback(async (product: Product) => {
        if (props.inlineCreationMode !== "NONE") {
            setSelectedProduct(product);
        } else {
            if (!props.onInlineCreation) return;
            const spec = props.onInlineCreation("", product, callbacks);
            setIsCreating(false);
            if ("path" in spec && "method" in spec) {
                await callbacks.invokeCommand(spec);
            } else {
                await callbacks.invokeCommand(api.create(bulkRequestOf(spec as Res["specification"])));
            }
            callbacks.reload();
        }
    }, [setSelectedProduct, props.inlineCreationMode, props.onInlineCreation, callbacks]);

    const [inlineCreationLoading, setInlineCreationLoading] = useState(false);
    const inlineInputRef = useRef<HTMLInputElement>(null);
    const onInlineCreate = useCallback(async () => {
        if (inlineInputRef.current && props.onInlineCreation) {
            const prefix = props?.inlinePrefix?.(selectedProductWithSupport!) ?? "";
            const suffix = props?.inlineSuffix?.(selectedProductWithSupport!) ?? "";

            const trimmedValue = inlineInputRef.current.value.trim();
            if (!trimmedValue) {
                snackbarStore.addFailure("Title can't be blank or empty", false);
                return;
            }

            const spec = props.onInlineCreation(
                prefix + trimmedValue + suffix,
                selectedProduct!,
                callbacks
            );

            setInlineCreationLoading(true);
            if ("path" in spec && "method" in spec) {
                await callbacks.invokeCommand(spec);
            } else {
                const timeout = setTimeout(() => snackbarStore.addInformation(`${api.title} will be created shortly.`, false), 3_500);
                await callbacks.invokeCommand(api.create(bulkRequestOf(spec as Res["specification"])));
                clearTimeout(timeout);
            }
            setInlineCreationLoading(false);
            callbacks.reload();
        }
        setIsCreating(false);
    }, [props.onInlineCreation, inlineInputRef, callbacks, setIsCreating, selectedProduct]);

    const operations = useMemo(() => api.retrieveOperations(), [callbacks, api]);

    const onSortUpdated = useCallback((dir: "ascending" | "descending", column?: string) => {
        setSortColumn(column);
        setSortDirection(dir);
        setStoredSortColumn(api.title, column);
        setStoredSortDirection(api.title, dir);
    }, []);

    const modifiedRenderer = useMemo((): ItemRenderer<Res> => {
        const renderer: ItemRenderer<Res> = {...api.renderer};
        const RemainingStats = renderer.Stats;
        const NormalMainTitle = renderer.MainTitle;
        renderer.MainTitle = function mainTitle({resource}) {
            if (resource === undefined) {
                return !selectedProduct ?
                    <ProductSelector products={products} onProductSelected={onProductSelected} />
                    :
                    <NamingField
                        confirmText={"Create"}
                        onCancel={() => setIsCreating(false)}
                        onSubmit={onInlineCreate}
                        inputRef={inlineInputRef}
                        disabled={inlineCreationLoading}
                        prefix={props.inlinePrefix && selectedProductWithSupport ?
                            props.inlinePrefix(selectedProductWithSupport) : null}
                        suffix={props.inlineSuffix && selectedProductWithSupport ?
                            props.inlineSuffix(selectedProductWithSupport) : null}
                    />;
            } else {
                return NormalMainTitle ? <NormalMainTitle browseType={props.browseType} resource={resource} callbacks={callbacks} /> : null;
            }
        };
        renderer.Stats = props.withDefaultStats !== false ? ({resource}) => (<>
            {!resource ? <>
                {props.showCreatedAt === false ? null :
                    <ListRowStat icon="calendar">{dateToString(timestampUnixMs())}</ListRowStat>}
                {props.showCreatedBy === false ? null : <ListRowStat icon={"user"}>{Client.username}</ListRowStat>}
                {props.showProduct === false || !selectedProduct ? null : <>
                    <ListRowStat
                        icon="cubeSolid">{selectedProduct.name} / {selectedProduct.category.name}</ListRowStat>
                </>}
            </> : <>
                {props.showCreatedAt === false ? null :
                    <ListRowStat icon={"calendar"}>{dateToString(resource.createdAt)}</ListRowStat>}
                {props.showCreatedBy === false || resource.owner.createdBy === "_ucloud" ? null :
                    <div className="tooltip">
                        <ListRowStat icon={"user"}>{" "}{resource.owner.createdBy}</ListRowStat>
                        <div className="tooltip-content centered">
                            <UserBox username={resource.owner.createdBy} />
                        </div>
                    </div>
                }
                {props.showProduct === false || resource.specification.product.provider === UCLOUD_CORE ? null :
                    <div className="tooltip">
                        <ListRowStat icon={"cubeSolid"}>
                            {" "}{resource.specification.product.id} / {resource.specification.product.category}
                        </ListRowStat>
                        <div className="tooltip-content">
                            <ProductBox resource={resource} productType={api.productType} />
                        </div>
                    </div>
                }
                {
                    !resource.permissions.myself.includes("ADMIN") || resource.owner.project == null ? null :
                        (props.showGroups === false ||
                            resource.permissions.others == null ||
                            resource.permissions.others.length <= 1) ? <ListRowStat>Not shared with any group</ListRowStat> :
                            <ListRowStat>{resource.permissions.others.length == 1 ? "" : resource.permissions.others.length - 1} {resource.permissions.others.length > 2 ? "groups" : "group"}</ListRowStat>
                }
            </>}
            {RemainingStats ? <RemainingStats browseType={props.browseType} resource={resource} callbacks={callbacks} /> : null}
        </>) : renderer.Stats;
        return renderer;
    }, [api, props.withDefaultStats, props.inlinePrefix, props.inlineSuffix, products, onProductSelected,
        onInlineCreate, inlineInputRef, selectedProductWithSupport, props.showCreatedAt, props.showCreatedBy,
        props.showProduct, props.showGroups]);

    const sortOptions = useMemo(() =>
        api.sortEntries.map(it => ({
            icon: it.icon,
            title: it.title,
            value: it.column,
            helpText: it.helpText
        })),
        [api.sortEntries]
    );

    const pageSize = useRef(0);

    const pageRenderer = useCallback<PageRenderer<Res>>(items => {
        /* HACK(Jonas): to ensure the toggleSet knows of the page contents when checking all. */
        toggleSet.allItems.current = items;
        const allChecked = toggleSet.checked.items.length === items.length && items.length > 0;
        return <>
            {pageSize.current > 0 ? (
                <Spacer mr="8px" left={
                    <Label style={{cursor: "pointer"}} width={"102px"}>
                        <Checkbox
                            style={{marginTop: "-2px"}}
                            onChange={() => allChecked ? toggleSet.uncheckAll() : toggleSet.checkAll()}
                            checked={allChecked}
                        />
                        Select all
                    </Label>
                } right={
                    <Flex width="auto">
                        {api.sortEntries.length === 0 ? null : <EnumFilterWidget
                            expanded={false}
                            browseType={BrowseType.Card}
                            propertyName="column"
                            title={sortOptions.find(it => it.value === sortColumn)?.title ?? "Sort By"}
                            facedownChevron
                            id={0}
                            onExpand={doNothing}
                            properties={filters}
                            options={sortOptions}
                            onPropertiesUpdated={updated => onSortUpdated(sortDirection, updated.column)}
                            icon="properties"
                        />}
                        <Box mx="8px" />
                        <EnumFilterWidget
                            expanded={false}
                            browseType={BrowseType.Card}
                            propertyName="direction"
                            title="Sort Direction"
                            facedownChevron
                            id={0}
                            onExpand={doNothing}
                            properties={filters}
                            options={sortDirections}
                            onPropertiesUpdated={updated => onSortUpdated(updated.direction as "ascending" | "descending", sortColumn)}
                            icon={sortDirection === "ascending" ? "sortAscending" : "sortDescending"}
                        />
                    </Flex>
                } />) : <Box height="27px" />}
            <List onContextMenu={preventDefault}>
                {!isCreating ? null :
                    <ItemRow
                        browseType={props.browseType}
                        renderer={modifiedRenderer as ItemRenderer<unknown>}
                        itemTitle={api.title} itemTitlePlural={api.titlePlural} toggleSet={toggleSet}
                        operations={operations} callbacks={callbacks}
                    />
                }
                {items.length > 0 || isCreating ? null : props.emptyPage ? props.emptyPage :
                    <>
                        No {api.titlePlural.toLowerCase()} matches your search/filter criteria.
                        Click &quot;Create {api.title.toLowerCase()}&quot; to create a new one.
                    </>
                }
                {items.map(it =>
                    <ItemRow
                        key={it.id}
                        browseType={props.browseType}
                        navigate={() => {
                            /* 
                                Can we use callback here? I think it should improve performance so it doesn't create
                                a new lambda on each iteration                            
                            */
                            if (props.navigateToChildren) {
                                const result = props.navigateToChildren?.(history, it)
                                if (result === "properties") {
                                    viewProperties(it);
                                }
                            } else {
                                viewProperties(it);
                            }
                        }}
                        renderer={modifiedRenderer} callbacks={callbacks} operations={operations}
                        item={it} itemTitle={api.title} itemTitlePlural={api.titlePlural} toggleSet={toggleSet}
                        renaming={renaming}
                    />
                )}
            </List>
        </>
    }, [toggleSet, isCreating, selectedProduct, props.withDefaultStats, selectedProductWithSupport, renaming,
        viewProperties]);

    if (!isEmbedded) {
        useTitle(api.titlePlural);
        useLoading(commandLoading);
        useSidebarPage(api.page);
        if (!props.disableSearch) useResourceSearch(api);
    }

    const main = !inlineInspecting ? <>
        <StandardBrowse isSearch={props.isSearch} browseType={props.browseType} pageSizeRef={pageSize}
            generateCall={generateFetch} pageRenderer={pageRenderer} reloadRef={reloadRef}
            setRefreshFunction={isEmbedded != true} onLoad={props.onResourcesLoaded} />
    </> : <>
        <api.Properties api={api} resource={inlineInspecting} reload={reloadRef.current} embedded={true}
            closeProperties={closeProperties} {...props.propsForInlineResources} />
    </>;

    const allPills = useMemo(() => {
        const result = [...api.filterPills];
        if (props.isSearch) {
            result.push(p => <StaticPill icon={"search"} title={"Query"} value={"Query: " + query} {...p} />)
        }
        return result;
    }, [api.filterPills, query, props.isSearch]);

    if (isEmbedded) {
        return <Box minWidth="700px" ref={scrollingContainerRef}>
            {/* Sticky box causes rerender. See "Bug"-tag above. */}
            {/* <StickyBox shadow={!scrollStatus.isAtTheTop} normalMarginX={"20px"}> */}
            {inlineInspecting ?
                <Heading.h3 flexGrow={1}>{api.titlePlural}</Heading.h3> :
                <>
                    <Operations selected={toggleSet.checked.items} location={"TOPBAR"}
                        entityNameSingular={api.title} entityNamePlural={api.titlePlural}
                        extra={callbacks} operations={operations} />
                    {props.header}
                    <ResourceFilter
                        pills={allPills} filterWidgets={api.filterWidgets} browseType={props.browseType}
                        sortEntries={api.sortEntries} sortDirection={sortDirection}
                        onSortUpdated={onSortUpdated} properties={filters} setProperties={setFilters}
                        readOnlyProperties={props.additionalFilters} />
                </>
            }
            {/* </StickyBox> */}
            {main}
        </Box>;
    } else {
        return <MainContainer
            header={props.header}
            headerSize={props.headerSize}
            main={main}
            sidebar={<Flex flexDirection={"column"} height={"100%"} pb={"16px"}>
                {inlineInspecting ? null :
                    <>
                        <Operations selected={toggleSet.checked.items} location={"SIDEBAR"}
                                    entityNameSingular={api.title} entityNamePlural={api.titlePlural}
                                    extra={callbacks} operations={operations}/>

                        <ResourceFilter pills={allPills} filterWidgets={api.filterWidgets}
                                        sortEntries={api.sortEntries} sortDirection={sortDirection}
                                        onSortUpdated={onSortUpdated} properties={filters} setProperties={setFilters}
                                        browseType={props.browseType}
                                        readOnlyProperties={props.additionalFilters}/>
                    </>
                }

                {!props.extraSidebar ? null : props.extraSidebar}
            </Flex>}
        />
    }
}

function UserBox(props: {username: string}) {
    const avatars = useAvatars();
    const avatar = avatars.cache[props.username] ?? defaultAvatar;
    return <div className="user-box" style={{display: "relative"}}>
        <div className="centered"><Avatar style={{marginTop: "-70px", width: "150px", marginBottom: "-70px"}} avatarStyle="circle" {...avatar} /></div>
        <div className="centered" style={{display: "flex", justifyContent: "center"}}>
            <Truncate mt="18px" fontSize="2em" mx="24px" width="100%">{props.username}</Truncate>
        </div>
        {/* Re-add when we know what to render below  */}
        {/* <div style={{justifyContent: "left", textAlign: "left"}}>
            <div><b>INFO:</b> The lifespan of foxes depend on where they live.</div>
            <div><b>INFO:</b> A fox living in the city, usually lives 3-5 years.</div>
            <div><b>INFO:</b> A fox living in a forest, usually lives 12-15 years.</div>
        </div> */}
    </div>;
}

function ProductBox<T extends Resource<ResourceUpdate, ResourceStatus, ResourceSpecification>>(
    props: {
        resource: T;
        productType?: ProductType
    }
) {
    const {resource} = props;
    const {product} = resource.specification;
    return <div className="product-box">
        {props.productType ? <Icon size="36px" mr="4px" name={productTypeToIcon(props.productType)} /> : null}
        <span>{product.id} / {product.category}</span>
        <div><b>ID:</b> {product.id}</div>
        <div><b>Category:</b> {product.category}</div>
        <div><b>Provider:</b> {product.provider}</div>
    </div>
}
