import * as React from "react";
import { connect } from "react-redux";
import { Cloud } from "Authentication/SDUCloudObject";
import { Link } from "react-router-dom";
import { Modal, Dropdown, Button, Icon, Table, Header, Input, Grid, Responsive, Checkbox, Divider } from "semantic-ui-react";
import { dateToString } from "Utilities/DateUtilities";
import * as Pagination from "Pagination";
import { BreadCrumbs } from "Breadcrumbs/Breadcrumbs";
import * as UF from "UtilityFunctions";
import { KeyCode } from "DefaultObjects";
import * as Actions from "./Redux/FilesActions";
import { updatePageTitle } from "Navigation/Redux/StatusActions";
import { FileSelectorModal } from "./FileSelector";
import { FileIcon } from "UtilityComponents";
import { Uploader } from "Uploader";
import { Page } from "Types";
import {
    FilesProps, SortBy, SortOrder, FilesStateProps, FilesOperations, MockedTableProps, File, CreateFolderProps,
    FilesTableHeaderProps, FilenameAndIconsProps, FileOptionsProps, FilesTableProps, SortByDropdownProps,
    MobileButtonsProps, FileOperation, ContextButtonsProps, Operation
} from ".";
import { ReduxObject } from "DefaultObjects";
import { setPrioritizedSearch } from "Navigation/Redux/HeaderActions";
import { startRenamingFiles, AllFileOperations, NewMockFolder } from "Utilities/FileUtilities";

class Files extends React.Component<FilesProps> {
    constructor(props) {
        super(props);
        const urlPath = props.match.params[0];
        const { history } = props;
        if (!urlPath) {
            history.push(`/files/${Cloud.homeFolder}/`);
        }
        props.setPageTitle();
        props.prioritizeFileSearch();
    }

    componentDidMount() {
        const { match, page, fetchFiles, sortOrder, sortBy } = this.props;
        fetchFiles(match.params[0], page.itemsPerPage, page.pageNumber, sortOrder, sortBy);
    }

    newFolder() {
        let { page } = this.props;
        page.items = page.items.filter(it => !it.isMockFolder)
        page.items = [NewMockFolder()].concat([...page.items]);
        this.props.updateFiles(page);
    }

    onRenameFile = (key: number, file: File, name: string) => {
        const { path, fetchPageFromPath, updateFiles, page } = this.props;
        if (key === KeyCode.ESC) {
            page.items.find(f => f.path === file.path).beingRenamed = false;
            page.items = page.items.filter(it => !it.isMockFolder);
            updateFiles(page);
        } else if (key === KeyCode.ENTER) {
            const fileNames = page.items.map((it) => UF.getFilenameFromPath(it.path));
            if (UF.isInvalidPathName(name, fileNames)) return;
            const fullPath = `${UF.addTrailingSlash(path)}${name}`;
            if (file.isMockFolder) {
                Cloud.post("/files/directory", { path: fullPath }).then(({ request }) => {
                    if (UF.inSuccessRange(request.status)) {
                        fetchPageFromPath(fullPath, page.itemsPerPage, this.props.sortOrder, this.props.sortBy);
                    }
                }).catch(() => UF.failureNotification("An error ocurred trying to creating the file."));
            } else {
                Cloud.post(`/files/move?path=${file.path}&newPath=${fullPath}`).then(({ request }) => {
                    if (UF.inSuccessRange(request.status)) {
                        fetchPageFromPath(fullPath, page.itemsPerPage, this.props.sortOrder, this.props.sortBy);
                    }
                }).catch(() => UF.failureNotification("An error ocurred trying to rename the file."));
            }
        }
    }

    shouldComponentUpdate(nextProps, _nextState): boolean {
        const { fetchFiles, page, loading, sortOrder, sortBy } = this.props;
        if (nextProps.path !== nextProps.match.params[0] && !loading) {
            fetchFiles(nextProps.match.params[0], page.itemsPerPage, page.pageNumber, sortOrder, sortBy);
        }
        return true;
    }

    checkAllFiles = (checked: boolean): void => {
        const { page, updateFiles } = this.props;
        page.items.forEach(file => file.isChecked = checked);
        updateFiles(page);
    }

    render() {
        const { page, path, loading, history, fetchFiles, checkFile, updateFiles, sortBy, sortOrder, leftSortingColumn,
            rightSortingColumn, setDisallowedPaths, setFileSelectorCallback, showFileSelector, error } = this.props;
        const selectedFiles = page.items.filter(file => file.isChecked);
        // Master Checkbox
        const checkedFilesCount = selectedFiles.length;
        const checkbox = (<Checkbox
            className="hidden-checkbox checkbox-margin"
            onClick={(_, d) => this.checkAllFiles(d.checked)}
            checked={page.items.length === checkedFilesCount && page.items.length > 0}
            indeterminate={checkedFilesCount < page.items.length && checkedFilesCount > 0}
            onChange={(e) => e.stopPropagation()}
        />);
        // Lambdas
        const goTo = (pageNumber: number) => this.props.fetchFiles(path, page.itemsPerPage, pageNumber, this.props.sortOrder, this.props.sortBy);
        const refetch = () => fetchFiles(path, page.itemsPerPage, page.pageNumber, this.props.sortOrder, this.props.sortBy);
        const navigate = (path: string) => history.push(`/files/${path}`);
        const fetchPageFromPath = (path: string) => {
            this.props.fetchPageFromPath(path, page.itemsPerPage, sortOrder, sortBy);
            this.props.updatePath(UF.getParentPath(path)); navigate(UF.getParentPath(path));
        };
        const fileSelectorOperations = { setDisallowedPaths, setFileSelectorCallback, showFileSelector, fetchPageFromPath };
        const favoriteFile = (files: File[]) => updateFiles(UF.favoriteFileFromPage(page, files, Cloud));
        const fileOperations: FileOperation[] = [
            { text: "Rename", onClick: (files: File[]) => updateFiles(startRenamingFiles(files, page)), disabled: (files: File[]) => false, icon: "edit", color: null },
            ...AllFileOperations(true, fileSelectorOperations, refetch, this.props.history)
        ];
        return (
            <Grid>
                <Grid.Column computer={13} tablet={16}>
                    <Grid.Row>
                        <Responsive
                            as={ContextButtons}
                            maxWidth={991}
                            createFolder={() => this.newFolder()}
                            currentPath={path}
                        />
                        <BreadCrumbs currentPath={path} navigate={(newPath) => navigate(newPath)} />
                    </Grid.Row>
                    <Pagination.List
                        loading={loading}
                        errorMessage={error}
                        onErrorDismiss={this.props.dismissError}
                        customEmptyPage={(<Header.Subheader content="No files in current folder" />)}
                        pageRenderer={(page) => (
                            <FilesTable
                                onFavoriteFile={favoriteFile}
                                fileOperations={fileOperations}
                                sortFiles={(sortBy: SortBy) => fetchFiles(path, page.itemsPerPage, page.pageNumber, sortOrder, sortBy)}
                                sortingIcon={(name: SortBy) => UF.getSortingIcon(sortBy, sortOrder, name)}
                                sortOrder={sortOrder}
                                sortingColumns={[leftSortingColumn, rightSortingColumn]}
                                refetchFiles={() => refetch()}
                                onDropdownSelect={(sortOrder: SortOrder, sortBy: SortBy, index: number) => fetchFiles(path, page.itemsPerPage, page.pageNumber, sortOrder, sortBy, index)}
                                masterCheckbox={checkbox}
                                creatingNewFolder={this.props.creatingFolder}
                                onRenameFile={this.onRenameFile}
                                files={page.items}
                                onCheckFile={(checked: boolean, file: File) => checkFile(checked, page, file)}
                            />
                        )}
                        onRefresh={refetch}
                        onItemsPerPageChanged={(pageSize) => fetchFiles(path, pageSize, 0, sortOrder, sortBy)}
                        page={page}
                        onPageChanged={(pageNumber) => goTo(pageNumber)}
                    />
                </Grid.Column>
                <Responsive as={Grid.Column} computer={3} minWidth={992}>
                    <ContextBar
                        fileOperations={fileOperations}
                        files={selectedFiles}
                        currentPath={path}
                        createFolder={() => this.newFolder()}
                        refetch={() => refetch()}
                    />
                </Responsive>
                <FileSelectorModal
                    show={this.props.fileSelectorShown}
                    onHide={() => this.props.showFileSelector(false)}
                    path={this.props.fileSelectorPath}
                    fetchFiles={(path, pageNumber, itemsPerPage) => this.props.fetchSelectorFiles(path, pageNumber, itemsPerPage)}
                    loading={this.props.fileSelectorLoading}
                    errorMessage={this.props.fileSelectorError}
                    onErrorDismiss={() => this.props.onFileSelectorErrorDismiss()}
                    onlyAllowFolders
                    canSelectFolders
                    page={this.props.fileSelectorPage}
                    setSelectedFile={this.props.fileSelectorCallback}
                    disallowedPaths={this.props.disallowedPaths}
                />
            </Grid>);
    }
}

export const FilesTable = ({
    files, masterCheckbox, sortingIcon, sortFiles, onRenameFile, onCheckFile, sortingColumns, onDropdownSelect,
    fileOperations, sortOrder, onFavoriteFile
}: FilesTableProps) => (
        <Table unstackable basic="very">
            <FilesTableHeader onDropdownSelect={onDropdownSelect} sortOrder={sortOrder} sortingColumns={sortingColumns} masterCheckbox={masterCheckbox} sortingIcon={sortingIcon} sortFiles={sortFiles} />
            <Table.Body>
                {files.map((f: File, i: number) => (
                    <Table.Row className="file-row" key={i}>
                        <FilenameAndIcons
                            file={f}
                            onFavoriteFile={onFavoriteFile}
                            hasCheckbox={masterCheckbox !== null}
                            onRenameFile={onRenameFile}
                            onCheckFile={(checked: boolean, newFile: File) => onCheckFile(checked, newFile)}
                        />
                        <Responsive as={Table.Cell} minWidth={768} content={sortingColumns ? UF.sortingColumnToValue(sortingColumns[0], f) : dateToString(f.modifiedAt)} />
                        <Responsive as={Table.Cell} minWidth={768} content={sortingColumns ? UF.sortingColumnToValue(sortingColumns[1], f) : UF.getOwnerFromAcls(f.acl)} />
                        <MobileButtons fileOperations={fileOperations} file={f} />
                    </Table.Row>)
                )}
            </Table.Body>
        </Table>
    );

const ResponsiveTableColumn = ({ asDropdown, iconName, onSelect, currentSelection, sortOrder, minWidth = null }) => (
    <Responsive minWidth={minWidth} as={Table.HeaderCell}>
        <SortByDropdown onSelect={onSelect} asDropdown={asDropdown} currentSelection={currentSelection} sortOrder={sortOrder} />
        <Icon className="float-right" name={iconName} />
    </Responsive>
)

const FilesTableHeader = ({ sortingIcon, sortFiles, sortOrder, masterCheckbox, sortingColumns, onDropdownSelect }: FilesTableHeaderProps) => (
    <Table.Header>
        <Table.Row>
            <Table.HeaderCell className="filename-row" onClick={() => sortFiles(SortBy.PATH)}>
                {masterCheckbox}
                Filename
                <Icon className="float-right" name={sortingIcon(SortBy.PATH)} />
            </Table.HeaderCell>
            {sortingColumns.map((sC, i) => (
                <ResponsiveTableColumn
                    key={i}
                    minWidth={768}
                    onSelect={(sortOrder: SortOrder, sortBy: SortBy) => onDropdownSelect(sortOrder, sortBy, i)}
                    currentSelection={sC}
                    sortOrder={sortOrder}
                    asDropdown={!!onDropdownSelect}
                    iconName={sortingIcon(sC)}
                />
            ))}
            <Table.HeaderCell />
        </Table.Row>
    </Table.Header>
);

const SortByDropdown = ({ currentSelection, sortOrder, onSelect, asDropdown }: SortByDropdownProps) => asDropdown ? (
    <Dropdown simple text={UF.prettierString(currentSelection)}>
        <Dropdown.Menu>
            <Dropdown.Item text={UF.prettierString(SortOrder.ASCENDING)} onClick={() => onSelect(SortOrder.ASCENDING, currentSelection)} disabled={sortOrder === SortOrder.ASCENDING} />
            <Dropdown.Item text={UF.prettierString(SortOrder.DESCENDING)} onClick={() => onSelect(SortOrder.DESCENDING, currentSelection)} disabled={sortOrder === SortOrder.DESCENDING} />
            <Dropdown.Divider />
            {Object.keys(SortBy).filter(it => it !== currentSelection).map((sortByKey: SortBy, i) => (
                <Dropdown.Item key={i} onClick={() => onSelect(sortOrder, sortByKey)} text={UF.prettierString(sortByKey)} />
            ))}
        </Dropdown.Menu>
    </Dropdown>) : <React.Fragment>{UF.prettierString(currentSelection)}</React.Fragment>;


interface ContextBarProps extends ContextButtonsProps, FileOptionsProps { }

const ContextBar = ({ currentPath, files, ...props }: ContextBarProps) => (
    <div>
        <ContextButtons refetch={props.refetch} currentPath={currentPath} createFolder={props.createFolder} />
        <Divider />
        <FileOptions files={files} {...props} />
    </div>
);

const ContextButtons = ({ currentPath, createFolder, refetch }: ContextButtonsProps) => (
    <div>
        <Modal trigger={<Button color="blue" className="context-button-margin" fluid content="Upload Files" />}>
            <Modal.Header content="Upload Files" />
            <Modal.Content scrolling>
                <Modal.Description>
                    <Uploader location={currentPath} onFilesUploaded={refetch} />
                </Modal.Description>
            </Modal.Content>
        </Modal>
        <Button basic className="context-button-margin" fluid onClick={() => createFolder()} content="New folder" />
        <Button as={Link} to={`/filesearch`} basic className="context-button-margin" fluid content="Advanced Search" color="green" />
    </div>
);

const PredicatedCheckbox = ({ predicate, item, onClick }) =>
    predicate ? (
        <Checkbox
            checked={item}
            type="checkbox"
            className="hidden-checkbox checkbox-margin"
            onClick={onClick}
        />
    ) : null;

const PredicatedFavorite = ({ predicate, item, onClick }) =>
    predicate ? (
        <Icon
            color="blue"
            name={item.favorited ? "star" : "star outline"}
            className={`${item.favorited ? "" : "file-data"} favorite-padding`}
            onClick={onClick}
        />
    ) : null;

const GroupIcon = ({ isProject }: { isProject: boolean }) => isProject ? (<Icon className="group-icon-padding" name="users" />) : null;

function FilenameAndIcons({ file, size = "big", onRenameFile, onCheckFile = null, hasCheckbox = false, onFavoriteFile = null }: FilenameAndIconsProps) {
    const fileName = UF.getFilenameFromPath(file.path);
    const checkbox = <PredicatedCheckbox predicate={hasCheckbox} item={file.isChecked} onClick={(_, { checked }) => onCheckFile(checked, file)} />
    const icon = (
        <FileIcon
            color={UF.isDirectory(file) ? "blue" : "grey"}
            name={UF.iconFromFilePath(file.path, file.type, Cloud.homeFolder)}
            size={size} link={file.link}
        />
    );
    const nameLink = (UF.isDirectory(file) ?
        <Link to={`/files/${file.path}`}>
            {icon}{fileName}
        </Link> : <React.Fragment>{icon}{fileName}</React.Fragment>);
    return file.beingRenamed ?
        <Table.Cell className="table-cell-padding-left">
            {checkbox}
            {icon}
            <Input
                defaultValue={fileName}
                onKeyDown={(e) => onRenameFile(e.keyCode, file, e.target.value)}
                autoFocus
                transparent
            />
        </Table.Cell> :
        <Table.Cell className="table-cell-padding-left">
            {checkbox}
            {nameLink}
            <GroupIcon isProject={UF.isProject(file)} />
            <PredicatedFavorite predicate={!!onFavoriteFile && !file.path.startsWith(`${Cloud.homeFolder}Favorites`)} item={file} onClick={() => onFavoriteFile([file])} />
        </Table.Cell>
};

function FileOptions({ files, fileOperations }: FileOptionsProps) {
    if (!files.length) return null;
    const fileText = UF.toFileText(files);
    return (
        <div>
            <Header as="h3">{fileText}</Header>
            <FileOperations files={files} fileOperations={fileOperations} As={Button} fluid basic />
        </div>
    );
};

export const FileOperations = ({ files, fileOperations, As, ...props }) =>
    fileOperations.map((fileOp, i) => {
        let operation = fileOp;
        if ("predicate" in fileOp) {
            operation = fileOp.predicate(files, Cloud) ? fileOp.onTrue : fileOp.onFalse;
        }
        operation = (operation as Operation);
        return !operation.disabled(files, Cloud) ? (
            <As
                key={i}
                disabled={operation.disabled(files, Cloud)}
                content={operation.text}
                icon={operation.icon}
                color={operation.color}
                className="context-button-margin"
                onClick={() => (operation as Operation).onClick(files, Cloud)}
                {...props}
            />
        ) : null;
    })

const MobileButtons = ({ file, fileOperations }: MobileButtonsProps) => (
    <Table.Cell>
        <Dropdown direction="left" icon="ellipsis horizontal">
            <Dropdown.Menu>
                <FileOperations files={[file]} className="context-button-margin" fileOperations={fileOperations} As={Dropdown.Item} />
            </Dropdown.Menu>
        </Dropdown>
    </Table.Cell>
);

const mapStateToProps = ({ files }: ReduxObject): FilesStateProps => {
    const { page, loading, path, fileSelectorPage, fileSelectorPath, sortBy, sortOrder, creatingFolder,
        fileSelectorShown, fileSelectorCallback, disallowedPaths, fileSelectorLoading, error, fileSelectorError,
        sortingColumns } = files;
    const favFilesCount = page.items.filter(file => file.favorited).length; // HACK to ensure changes to favorites are rendered.
    const checkedFilesCount = page.items.filter(file => file.isChecked).length; // HACK to ensure changes to file checkings are rendered.
    const renamingCount = page.items.filter(file => file.beingRenamed).length;
    const fileCount = page.items.length;
    return {
        error, fileSelectorError, page, loading, path, checkedFilesCount, favFilesCount, fileSelectorPage, fileSelectorPath,
        fileSelectorShown, fileSelectorCallback, disallowedPaths, sortOrder, sortBy, creatingFolder, fileCount,
        fileSelectorLoading, leftSortingColumn: sortingColumns[0], rightSortingColumn: sortingColumns[1], renamingCount
    }
};

const mapDispatchToProps = (dispatch): FilesOperations => ({
    prioritizeFileSearch: () => dispatch(setPrioritizedSearch("files")),
    onFileSelectorErrorDismiss: () => dispatch(Actions.setFileSelectorError(null)),
    dismissError: () => dispatch(Actions.setErrorMessage()),
    fetchFiles: (path: string, itemsPerPage: number, pageNumber: number, sortOrder: SortOrder, sortBy: SortBy, index?: number) => {
        dispatch(Actions.updatePath(path));
        dispatch(Actions.setLoading(true));
        if (index != null) dispatch(Actions.setSortingColumn(sortBy, index));
        dispatch(Actions.fetchFiles(path, itemsPerPage, pageNumber, sortOrder, sortBy))
    },
    fetchPageFromPath: (path: string, itemsPerPage: number, sortOrder: SortOrder, sortBy: SortBy) => {
        dispatch(Actions.setLoading(true));
        dispatch(Actions.fetchPageFromPath(path, itemsPerPage, sortOrder, sortBy));
    },
    updatePath: (path: string) => dispatch(Actions.updatePath(path)),
    fetchSelectorFiles: (path: string, pageNumber: number, itemsPerPage: number) => dispatch(Actions.fetchFileselectorFiles(path, pageNumber, itemsPerPage)),
    showFileSelector: (open: boolean) => dispatch(Actions.fileSelectorShown(open)),
    setFileSelectorCallback: (callback) => dispatch(Actions.setFileSelectorCallback(callback)),
    checkFile: (checked: boolean, page: Page<File>, newFile: File) => { // FIXME: Make an action instead with path?
        page.items.find(file => file.path === newFile.path).isChecked = checked;
        dispatch(Actions.updateFiles(page));
    },
    setPageTitle: () => dispatch(updatePageTitle("Files")),
    updateFiles: (page: Page<File>) => dispatch(Actions.updateFiles(page)),
    setDisallowedPaths: (disallowedPaths: string[]) => dispatch(Actions.setDisallowedPaths(disallowedPaths)),
    setCreatingFolder: (creating) => dispatch(Actions.setCreatingFolder(creating))
});

export default connect(mapStateToProps, mapDispatchToProps)(Files);