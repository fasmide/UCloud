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
    MobileButtonsProps, FileOperations, ContextButtonsProps
} from ".";
import { FilesReduxObject } from "DefaultObjects";
import { setPrioritizedSearch } from "Navigation/Redux/HeaderActions";
import { startRenamingFiles, AllFileOperations } from "Utilities/FileUtilities";

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
        const { match, page, fetchFiles, fetchSelectorFiles, sortOrder, sortBy, leftSortingColumn, rightSortingColumn } = this.props;
        fetchFiles(match.params[0], page.itemsPerPage, page.pageNumber, sortOrder, sortBy, [leftSortingColumn, rightSortingColumn]);
        fetchSelectorFiles(Cloud.homeFolder, page.pageNumber, page.itemsPerPage);
    }

    onRenameFile = (key: number, file: File, name: string) => {
        if (key === KeyCode.ESC) {
            file.beingRenamed = false;
        } else if (key === KeyCode.ENTER) {
            const { path, fetchPageFromPath, page } = this.props;
            const fileNames = page.items.map((it) => UF.getFilenameFromPath(it.path));
            if (UF.isInvalidPathName(name, fileNames)) return;
            const fullPath = `${UF.addTrailingSlash(path)}${name}`;
            Cloud.post(`/files/move?path=${file.path}&newPath=${fullPath}`).then(({ request }) => {
                if (UF.inSuccessRange(request.status)) {
                    fetchPageFromPath(fullPath, page.itemsPerPage, this.props.sortOrder, this.props.sortBy);
                }
            }).catch(() => UF.failureNotification("An error ocurred trying to rename the file."));
        }
    }

    onCreateFolder = (key: number, name: string): void => {
        if (key === KeyCode.ESC) {
            this.props.resetFolderEditing();
        } else if (key === KeyCode.ENTER) {
            const { path, fetchPageFromPath, page } = this.props;
            const fileNames = page.items.map((it) => UF.getFilenameFromPath(it.path));
            if (UF.isInvalidPathName(name, fileNames)) return;
            const fullPath = `${UF.addTrailingSlash(path)}${name}`;
            Cloud.post("/files/directory", { path: fullPath }).then(({ request }) => {
                if (UF.inSuccessRange(request.status)) {
                    this.props.resetFolderEditing();
                    fetchPageFromPath(fullPath, page.itemsPerPage, this.props.sortOrder, this.props.sortBy);
                }
            }).catch(() => this.props.resetFolderEditing());
        }
    }

    shouldComponentUpdate(nextProps, _nextState): boolean {
        const { fetchFiles, page, loading, sortOrder, sortBy, leftSortingColumn, rightSortingColumn } = this.props;
        if (nextProps.path !== nextProps.match.params[0] && !loading) {
            fetchFiles(nextProps.match.params[0], page.itemsPerPage, page.pageNumber, sortOrder, sortBy, [leftSortingColumn, rightSortingColumn]);
        }
        return true;
    }

    checkAllFiles = (checked: boolean): void => {
        const { page, updateFiles } = this.props;
        page.items.forEach(file => file.isChecked = checked);
        updateFiles(page);
    }

    render() {
        // Props
        const { page, path, loading, history, fetchFiles, checkFile, updateFiles, sortBy, sortOrder, error,
            leftSortingColumn, rightSortingColumn } = this.props;
        const selectedFiles = page.items.filter(file => file.isChecked);
        // Master Checkbox
        const checkedFilesCount = selectedFiles.length;
        const masterCheckboxChecked = page.items.length === checkedFilesCount && page.items.length > 0;
        const indeterminate = checkedFilesCount < page.items.length && checkedFilesCount > 0;
        // Lambdas
        const goTo = (pageNumber: number) => {
            this.props.fetchFiles(path, page.itemsPerPage, pageNumber, this.props.sortOrder, this.props.sortBy, [leftSortingColumn, rightSortingColumn]);
            this.props.resetFolderEditing();
        };
        const refetch = () => fetchFiles(path, page.itemsPerPage, page.pageNumber, this.props.sortOrder, this.props.sortBy, [leftSortingColumn, rightSortingColumn]);
        const navigate = (path: string) => history.push(`/files/${path}`);
        const fetchPageFromPath = (path: string) => {
            this.props.fetchPageFromPath(path, page.itemsPerPage, sortOrder, sortBy);
            this.props.updatePath(UF.getParentPath(path)); navigate(UF.getParentPath(path));
        };
        const { setDisallowedPaths, setFileSelectorCallback, showFileSelector } = this.props;
        const fileSelectorOperations = { setDisallowedPaths, setFileSelectorCallback, showFileSelector, fetchPageFromPath };

        const favoriteFile = (files: File[]) => updateFiles(UF.favoriteFileFromPage(page, files, Cloud));

        const fileOperations: FileOperations = [
            { text: "Favorite", onClick: favoriteFile, disabled: (files: File[]) => false, icon: "star" },
            ...AllFileOperations(true, fileSelectorOperations, refetch, this.props.history),
            { text: "Rename", onClick: (files: File[]) => updateFiles(startRenamingFiles(files, page)), disabled: (files: File[]) => false, icon: "edit" }
        ];

        return (
            <Grid>
                <Grid.Column computer={13} tablet={16}>
                    <Grid.Row>
                        <Responsive
                            as={ContextButtons}
                            maxWidth={991}
                            createFolder={() => this.props.setCreatingFolder(true)}
                            currentPath={path}
                        />
                        <BreadCrumbs currentPath={path} navigate={(newPath) => navigate(newPath)} />
                    </Grid.Row>
                    <Pagination.List
                        loading={loading}
                        onRefreshClick={refetch}
                        errorMessage={error}
                        onErrorDismiss={this.props.dismissError}
                        customEmptyPage={
                            this.props.creatingFolder ? (
                                <MockTable creatingFolder={this.props.creatingFolder} onCreateFolder={this.onCreateFolder} />) : (
                                    <Header.Subheader content="No files in current folder" />
                                )
                        }
                        pageRenderer={(page) => (
                            <FilesTable
                                onFavoriteFile={favoriteFile}
                                fileOperations={fileOperations}
                                sortFiles={(sortBy: SortBy) => fetchFiles(path, page.itemsPerPage, page.pageNumber, sortOrder === SortOrder.ASCENDING ? SortOrder.DESCENDING : SortOrder.ASCENDING, sortBy, [leftSortingColumn, rightSortingColumn])}
                                sortingIcon={(name: SortBy) => UF.getSortingIcon(sortBy, sortOrder, name)}
                                sortingColumns={[leftSortingColumn, rightSortingColumn]}
                                refetchFiles={() => refetch()}
                                onDropdownSelect={(sortBy: SortBy, sortingColumns: [SortBy, SortBy]) => fetchFiles(path, page.itemsPerPage, page.pageNumber, sortOrder === SortOrder.ASCENDING ? SortOrder.DESCENDING : SortOrder.ASCENDING, sortBy, sortingColumns)}
                                masterCheckbox={
                                    <Checkbox
                                        className="hidden-checkbox checkbox-margin"
                                        onClick={(_, d) => this.checkAllFiles(d.checked)}
                                        checked={masterCheckboxChecked}
                                        indeterminate={indeterminate}
                                        onChange={(e) => e.stopPropagation()}
                                    />}
                                creatingNewFolder={this.props.creatingFolder}
                                onCreateFolder={this.onCreateFolder}
                                onRenameFile={this.onRenameFile}

                                files={page.items}
                                onCheckFile={(checked: boolean, file: File) => checkFile(checked, page, file)}
                                editFolderIndex={this.props.editFileIndex}
                                startEditFile={this.props.setEditingFileIndex}
                            />
                        )}
                        onItemsPerPageChanged={(pageSize) => { this.props.resetFolderEditing(); fetchFiles(path, pageSize, 0, sortOrder, sortBy, [leftSortingColumn, rightSortingColumn]) }}
                        page={page}
                        onPageChanged={(pageNumber) => goTo(pageNumber)}
                    />
                </Grid.Column>
                <Responsive as={Grid.Column} computer={3} minWidth={992}>
                    <ContextBar
                        fileOperations={fileOperations}
                        files={selectedFiles}
                        currentPath={path}
                        createFolder={() => this.props.setCreatingFolder(true)}
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

// Used for creation of folder in empty folder
const MockTable = ({ onCreateFolder, creatingFolder }: MockedTableProps) => (
    <Table unstackable basic="very">
        <FilesTableHeader masterCheckbox={null} sortingIcon={() => null} sortFiles={null} />
        <Table.Body><CreateFolder creatingNewFolder={creatingFolder} onCreateFolder={onCreateFolder} /></Table.Body>
    </Table>
)

export const FilesTable = ({
    files, masterCheckbox, sortingIcon, sortFiles, onCreateFolder, onRenameFile, onCheckFile,
    startEditFile, creatingNewFolder, sortingColumns, onDropdownSelect, fileOperations
}: FilesTableProps) => (
        <Table unstackable basic="very">
            <FilesTableHeader onDropdownSelect={onDropdownSelect} sortingColumns={sortingColumns} masterCheckbox={masterCheckbox} sortingIcon={sortingIcon} sortFiles={sortFiles} />
            <Table.Body>
                <CreateFolder creatingNewFolder={creatingNewFolder} onCreateFolder={onCreateFolder} />
                {files.map((f: File, i: number) => (
                    <Table.Row className="file-row" key={i}>
                        <FilenameAndIcons
                            file={f}
                            onFavoriteFile={null}
                            hasCheckbox={masterCheckbox !== null}
                            onRenameFile={onRenameFile}
                            onCheckFile={(checked: boolean, newFile: File) => onCheckFile(checked, newFile)}
                        />
                        <Responsive as={Table.Cell} minWidth={768}>
                            {sortingColumns ? UF.sortingColumnToValue(sortingColumns[0], f) : dateToString(f.modifiedAt)}
                        </Responsive>
                        <Responsive as={Table.Cell} minWidth={768}>
                            {sortingColumns ? UF.sortingColumnToValue(sortingColumns[1], f) : UF.getOwnerFromAcls(f.acl)}
                        </Responsive>
                        <MobileButtons
                            fileOperations={fileOperations}
                            startEditFile={startEditFile}
                            file={f}
                            rename={!!startEditFile ? () => startEditFile(i) : null}
                        />
                    </Table.Row>)
                )}
            </Table.Body>
        </Table>
    );


function FilesTableHeader({ sortingIcon, sortFiles, masterCheckbox, sortingColumns, onDropdownSelect }: FilesTableHeaderProps) {
    let column1 = null;
    let column2 = null;
    if (sortingColumns != null) {
        column1 = (
            <Responsive minWidth={768} as={Table.HeaderCell} onClick={() => sortFiles(sortingColumns[0])}>
                <SortByDropdown onSelect={(sortBy: SortBy) => onDropdownSelect(sortBy, [sortBy, sortingColumns[1]])} currentSelection={sortingColumns[0]} sortOrder={SortOrder.ASCENDING} onSortOrderChange={(sortOrder: SortOrder) => console.log(sortOrder, 0)} />
                <Icon className="float-right" name={sortingIcon(sortingColumns[0])} />
            </Responsive>
        );
        column2 = (
            <Responsive minWidth={768} as={Table.HeaderCell} onClick={() => sortFiles(sortingColumns[1])}>
                <SortByDropdown onSelect={(sortBy: SortBy) => onDropdownSelect(sortBy, [sortingColumns[0], sortBy])} currentSelection={sortingColumns[1]} sortOrder={SortOrder.ASCENDING} onSortOrderChange={(sortOrder: SortOrder) => console.log(sortOrder, 1)} />
                <Icon className="float-right" name={sortingIcon(sortingColumns[1])} />
            </Responsive>
        );
    } else {
        column1 = (<Responsive minWidth={768} as={Table.HeaderCell} content="Modified at" />);
        column2 = (<Responsive minWidth={768} as={Table.HeaderCell} content="Members" />); // FIXME "Members is not consistent"
    }
    return (
        <Table.Header>
            <Table.Row>
                <Table.HeaderCell className="filename-row" onClick={() => sortFiles(SortBy.PATH)}>
                    {masterCheckbox}
                    Filename
                    <Icon className="float-right" name={sortingIcon(SortBy.PATH)} />
                </Table.HeaderCell>
                {column1}
                {column2}
                <Table.HeaderCell />
            </Table.Row>
        </Table.Header>
    );
}

const SortByDropdown = ({ currentSelection, sortOrder, onSortOrderChange, onSelect }: SortByDropdownProps) => {
    return (
        <Dropdown simple text={UF.prettierString(currentSelection)}>
            <Dropdown.Menu>
                <Dropdown.Item text={UF.prettierString(SortOrder.ASCENDING)} onClick={(_, { value }) => onSortOrderChange(value as SortOrder)} disabled={true/* sortOrder === SortOrder.ASCENDING */} />
                <Dropdown.Item text={UF.prettierString(SortOrder.DESCENDING)} onClick={(_, { value }) => onSortOrderChange(value as SortOrder)} disabled={true/* sortOrder === SortOrder.DESCENDING */} />
                <Dropdown.Divider />
                {Object.keys(SortBy).filter(it => it !== currentSelection).map((sortByKey: SortBy, i: number) => (
                    <Dropdown.Item key={i} onClick={() => onSelect(sortByKey)} text={UF.prettierString(sortByKey)} />
                ))}
            </Dropdown.Menu>
        </Dropdown>
    )
}

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

const CreateFolder = ({ creatingNewFolder, onCreateFolder }: CreateFolderProps) => (
    !creatingNewFolder ? null : (
        <Table.Row>
            <Table.Cell>
                <Input
                    fluid
                    transparent
                    onKeyDown={(e) => onCreateFolder(e.keyCode, e.target.value)}
                    placeholder="Folder name..."
                    autoFocus
                >
                    <Icon name="folder" color="blue" size="big" className="create-folder" />
                    <input className="input-left-margin" />
                </Input>
            </Table.Cell>
            <Responsive as={Table.Cell} /><Responsive as={Table.Cell} /><Table.Cell />
        </Table.Row>
    )
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
    const color = UF.isDirectory(file) ? "blue" : "grey";
    const fileName = UF.getFilenameFromPath(file.path);
    const checkbox = <PredicatedCheckbox predicate={hasCheckbox} item={file.isChecked} onClick={(_, { checked }) => onCheckFile(checked, file)} />
    const icon = (
        <FileIcon
            color={color}
            name={UF.isDirectory(file) ? "folder" : UF.iconFromFilePath(file.path)}
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
            <PredicatedFavorite predicate={!!onFavoriteFile && !file.path.startsWith(`${Cloud.homeFolder}Favorites/`)} item={file} onClick={() => onFavoriteFile([file])} />
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

const FileOperations = ({ files, fileOperations, As, ...props }) =>
    fileOperations.map((fileOp, i) => {
        let operation = fileOp;
        if ("predicate" in fileOp) {
            operation = fileOp.predicate(files) ? fileOp.onTrue : fileOp.onFalse;
        }
        return (
            <As
                key={i}
                disabled={operation.disabled(files)}
                content={operation.text}
                icon={operation.icon}
                onClick={() => operation.onClick(files)}
                {...props}
            />
        );
    })

const MobileButtons = ({ file, rename, ...props }: MobileButtonsProps) => (
    <Table.Cell>
        <Dropdown direction="left" icon="ellipsis horizontal">
            <Dropdown.Menu>
                <FileOperations files={[file]} className="context-button-margin" fileOperations={props.fileOperations} As={Dropdown.Item} />
            </Dropdown.Menu>
        </Dropdown>
    </Table.Cell>
);

const mapStateToProps = ({ files }: { files: FilesReduxObject }): FilesStateProps => {
    const { page, loading, path, fileSelectorPage, fileSelectorPath, sortBy, sortOrder, editFileIndex, creatingFolder,
        fileSelectorShown, fileSelectorCallback, disallowedPaths, fileSelectorLoading, error, fileSelectorError,
        sortingColumns } = files;
    const favFilesCount = page.items.filter(file => file.favorited).length; // HACK to ensure changes to favorites are rendered.
    const checkedFilesCount = page.items.filter(file => file.isChecked).length; // HACK to ensure changes to file checkings are rendered.
    const renamingCount = page.items.filter(file => file.beingRenamed).length;
    return {
        error, fileSelectorError, page, loading, path, checkedFilesCount, favFilesCount, fileSelectorPage, fileSelectorPath,
        fileSelectorShown, fileSelectorCallback, disallowedPaths, sortOrder, sortBy, editFileIndex, creatingFolder,
        fileSelectorLoading, leftSortingColumn: sortingColumns[0], rightSortingColumn: sortingColumns[1], renamingCount
    }
};

const mapDispatchToProps = (dispatch): FilesOperations => ({
    prioritizeFileSearch: () => dispatch(setPrioritizedSearch("files")),
    onFileSelectorErrorDismiss: () => dispatch(Actions.setFileSelectorError(null)),
    dismissError: () => dispatch(Actions.setErrorMessage()),
    fetchFiles: (path: string, itemsPerPage: number, pageNumber: number, sortOrder: SortOrder, sortBy: SortBy, sortingColumns: [SortBy, SortBy]) => {
        // FIXME SortBy can be matched with index instead of providing sortingColumns as well.
        dispatch(Actions.updatePath(path));
        dispatch(Actions.setLoading(true));
        dispatch(Actions.setSortingColumns(sortingColumns));
        dispatch(Actions.fetchFiles(path, itemsPerPage, pageNumber, sortOrder, sortBy))
    },
    fetchPageFromPath: (path: string, itemsPerPage: number, sortOrder: SortOrder, sortBy: SortBy) => {
        dispatch(Actions.setLoading(true));
        dispatch(Actions.fetchPageFromPath(path, itemsPerPage, sortOrder, sortBy))
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
    setCreatingFolder: (creating) => dispatch(Actions.setCreatingFolder(creating)),
    setEditingFileIndex: (index) => dispatch(Actions.setEditingFile(index)),
    resetFolderEditing: () => dispatch(Actions.resetFolderEditing())
});

export default connect(mapStateToProps, mapDispatchToProps)(Files);