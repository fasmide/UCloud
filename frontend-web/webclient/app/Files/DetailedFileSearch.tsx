import * as React from "react";
import { connect } from "react-redux";
import { Grid, Dropdown, Label, Header, Form, Button, Input, Checkbox } from "semantic-ui-react";
import { addEntryIfNotPresent } from "Utilities/ArrayUtilities"
import { infoNotification } from "UtilityFunctions";

interface DetailedFileSearchProps {

}

type SensitivityLevel = "Open Access" | "Confidential" | "Sensitive";

interface DetailedFileSearchState {
    allowFolders: boolean
    allowFiles: boolean
    filename: string
    extensions: string[]
    extensionValue: string
    tags: string[]
    sensitivities: SensitivityLevel[]
}

class DetailedFileSearch extends React.Component<DetailedFileSearchProps, DetailedFileSearchState> {
    constructor(props) {
        super(props);
        this.state = {
            allowFolders: true,
            allowFiles: true,
            filename: "",
            extensionValue: "",
            extensions: [],
            tags: [],
            sensitivities: []
        }
    }

    onAddSensitivity(sensitivity: SensitivityLevel): void {
        const { sensitivities } = this.state;
        if (sensitivities.includes(sensitivity)) return;
        sensitivities.push(sensitivity);
        this.setState(() => ({ sensitivities }));
    }

    onRemoveSensitivity(sensitivity: SensitivityLevel): void {
        const { sensitivities } = this.state;
        const remainingSensitivities = sensitivities.filter(s => s !== sensitivity)
        this.setState(() => ({ sensitivities: remainingSensitivities }));
    }

    // Not DRY
    onRemoveExtension(extension: string) {
        const { extensions } = this.state;
        const remaining = extensions.filter(e => e !== extension);
        this.setState(() => ({ extensions: remaining }));
    }

    onAddExtension() {
        const { extensionValue, extensions } = this.state;
        const newExtensions = extensionValue.trim().split(" ").filter(it => it);
        let entryAdded = false;
        newExtensions.forEach(ext => { entryAdded = addEntryIfNotPresent(extensions, ext) || entryAdded });
        this.setState(() => ({
            extensions,
            extensionValue: entryAdded ? "" : extensionValue
        }));
        if (!entryAdded) {
            infoNotification("Extension already added");
        }
    }

    onAddPresets(presetExtensions: string) {
        const ext = presetExtensions.trim().split(" ").filter(it => it);
        const { extensions } = this.state;
        ext.forEach(it => addEntryIfNotPresent(extensions, it));
        this.setState(() => ({ extensions }));
    }

    render() {
        const { sensitivities, extensions, extensionValue, allowFiles, allowFolders, filename } = this.state;
        const remainingSensitivities = sensitivityOptions.filter(s => !sensitivities.includes(s.text as SensitivityLevel));
        let sensitivityDropdown = null;
        if (remainingSensitivities.length) {
            sensitivityDropdown = (
                <div>
                    <Dropdown
                        text="Add sensitivity level"
                        onChange={(_, { value }) => this.onAddSensitivity(value as SensitivityLevel)}
                        options={remainingSensitivities}
                    />
                </div>
            );
        }
        return (
            <Grid container columns={16}>
                <Grid.Column width={16}>
                    <Header as="h3" content="Filename" />
                    {filename ? <div style={{ paddingBottom: "5px" }}><Label content={`Filename contains: ${filename}`} active={false} basic /></div> : null}
                    <Input fluid placeholder={"Filename must include..."} onChange={(_, { value }) => this.setState(() => ({ filename: value }))} />
                    <Header as="h3" content="Created at" />
                    <Form onSubmit={(e) => e.preventDefault()}>
                        <Form.Group widths="equal">
                            <Form.Field>
                                <label>Created after date</label>
                                <Input type="date" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                            <Form.Field>
                                <label>Created after time</label>
                                <Input type="time" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                            <Form.Field>
                                <label>Created before date</label>
                                <Input type="date" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                            <Form.Field>
                                <label>Created before time</label>
                                <Input type="time" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                        </Form.Group>
                    </Form>
                    <Header as="h3" content="Modified at" />
                    <Form onSubmit={(e) => e.preventDefault()} >
                        <Form.Group widths="equal">
                            <Form.Field>
                                <label>Modified after date</label>
                                <Input type="date" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                            <Form.Field>
                                <label>Modified after time</label>
                                <Input type="time" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                            <Form.Field>
                                <label>Modified before date</label>
                                <Input type="date" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                            <Form.Field>
                                <label>Modified before time</label>
                                <Input type="time" onChange={(_, { value }) => console.log(value)} />
                            </Form.Field>
                        </Form.Group>
                    </Form>
                    <Header as="h3" content="Type" />
                    <Form.Group widths="equal">
                        <Checkbox style={{ paddingRight: "15px" }} label="Folders" checked={allowFolders} onClick={() => this.setState(() => ({ allowFolders: !allowFolders }))} />
                        <Checkbox style={{ paddingRight: "15px" }} label="Files" checked={allowFiles} onClick={() => this.setState(() => ({ allowFiles: !allowFiles }))} />
                    </Form.Group>
                    <Header as="h3" content="File extensions" />
                    <SearchLabels labels={extensions} onLabelRemove={(l) => this.onRemoveExtension(l)} />
                    <Form onSubmit={(e) => { e.preventDefault(); this.onAddExtension(); }}>
                        <Form.Input value={extensionValue} onChange={(_, { value }) => this.setState(() => ({ extensionValue: value }))} />
                        <Dropdown
                            text="Add extension preset"
                            onChange={(_, { value }) => this.onAddPresets(value as string)}
                            options={extensionPresets}
                        />
                    </Form>
                    <Header as="h3" content="Sensitivity" />
                    <SearchLabels labels={sensitivities} onLabelRemove={(l) => this.onRemoveSensitivity(l)} />
                    {sensitivityDropdown}
                    <Button style={{ marginTop: "15px" }} content="Search" color="blue" onClick={() => console.log("Almost submitted!")} />
                </Grid.Column>
            </Grid>
        );
    }
}

const SearchLabels = (props) => (
    <div style={{ paddingBottom: "5px" }}>
        {props.labels.map((l, i) => (<Label basic key={i} content={l} onRemove={() => props.onLabelRemove(l)} />))}
    </div>
);

const extensionPresets = [
    { key: "text", content: "Text", value: ".txt .docx .rtf .csv .pdf" },
    { key: "image", content: "Image", value: ".png .jpeg .jpg .ppm .gif" },
    { key: "sound", content: "Sound", value: ".mp3 .ogg .wav .flac .aac" },
    { key: "compressed", content: "Compressed files", value: ".zip .tar.gz" }
]

const sensitivityOptions = [
    { key: "open_access", text: "Open Access", value: "Open Access" },
    { key: "confidential", text: "Confidential", value: "Confidential" },
    { key: "sensitive", text: "Sensitive", value: "Sensitive" }
]

export default connect()(DetailedFileSearch);

// Search by extensions, sensitivity, tags, etc.