import * as React from "react";
import { Search, Form, Header, Dropdown, Button } from "semantic-ui-react";
import { identifierTypes } from "../../DefaultObjects";
import { createRange } from "../../UtilityFunctions";
import { allLicenses } from "./licenses";
import { Creator, Grant, RelatedIdentifier, Subject, getById, updateById } from "./api";

const newCollaborator = (): Creator => ({ name: "", affiliation: "", orcId: "", gnd: "" });
const newGrant = (): Grant => ({ id: "" });
const newIdentifier = (): RelatedIdentifier => ({ identifier: "", relation: "" });
const newSubject = (): Subject => ({ term: "", identifier: "" });

const creatorHasValue = (creator: Creator): boolean => {
    return (
        !blankOrNull(creator.affiliation) ||
        !blankOrNull(creator.orcId) ||
        !blankOrNull(creator.gnd) ||
        !blankOrNull(creator.name)
    );
}

const subjectHasValue = (subject: Subject): boolean => {
    return (
        !blankOrNull(subject.identifier) ||
        !blankOrNull(subject.term)
    );
}

const identifierHasValue = (identifier: RelatedIdentifier): boolean => {
    return (
        !blankOrNull(identifier.identifier) ||
        !blankOrNull(identifier.relation)
    );
};

export class CreateUpdate extends React.Component<any, any> {
    constructor(props: any) {
        super(props);
        this.state = {
            id: "2",
            title: "",
            description: "",
            license: null,
            keywords: [""],
            notes: "",
            contributors: [newCollaborator()],
            references: [""],
            grants: [newGrant(), newGrant()],
            subjects: [newSubject()],
            relatedIdentifiers: [newIdentifier()],
            errors: { contributors: {}, subjects: {}, relatedIdentifiers: {} }
        };

        this.setStateEv = this.setStateEv.bind(this);
        this.setStateEvList = this.setStateEvList.bind(this);
    }

    componentDidMount() {
        getById(this.state.id).then(e => {
            const license = allLicenses.find(it => it.identifier == e.license);
            const mappedLicense = license ? {
                title: license.name,
                link: license.link,
                identifier: license.identifier
            } : null;

            this.setState({
                title: e.title,
                description: e.description,
                license: mappedLicense,
                keywords: e.keywords ? e.keywords : [""],
                notes: e.notes ? e.notes : "",
                contributors: e.contributors ? e.contributors : [newCollaborator()],
                references: e.references ? e.references : [""],
                grants: e.grants ? e.grants : [newGrant()],
                subjects: e.subjects ? e.subjects : [newSubject()],
                relatedIdentifiers: e.relatedIdentifiers ?
                    e.relatedIdentifiers : [newIdentifier()]
            });
        });
    }

    onSubmit(e) {
        e.preventDefault();

        const hasErrors = this.validateForm();
        console.log(hasErrors);

        if (!hasErrors) {
            const s = this.state;
            const licenseIdentifier = s.license ? s.license.identifier : null;

            const payload = {
                id: s.id,
                title: s.title,
                description: s.description,
                license: licenseIdentifier,
                keywords: s.keywords.filter(e => !blankOrNull(e)),
                // notes, // TODO Needs to be user editable
                contributors: s.contributors.filter(e => creatorHasValue(e)),
                references: s.references.filter(e => !blankOrNull(e)),
                subjects: s.subjects.filter(e => subjectHasValue(e)),
                relatedIdentifiers: s.relatedIdentifiers.filter(e => identifierHasValue(e))
            };

            updateById(payload)
                .then(it => console.log("Success!"))
                .catch(it => console.warn("Failure!", it));
        }
    }

    validateForm(): boolean {
        let errors = {};

        if (blankOrNull(this.state.title)) errors["title"] = true;
        if (blankOrNull(this.state.description)) errors["description"] = true;

        let errCollaborators = {};
        this.state.contributors.forEach((element, index) => {
            if (creatorHasValue(element)) {
                if (blankOrNull(element.name)) errCollaborators[index] = true;
            }
        });
        errors["contributors"] = errCollaborators;

        let errSubjects = {};
        this.state.subjects.forEach((element, index) => {
            if (subjectHasValue(element)) {
                if (blankOrNull(element.term)) errSubjects[index] = true;
            }
        });
        errors["subjects"] = errSubjects;

        let errIdentifiers = {};
        this.state.relatedIdentifiers.forEach((element, index) => {
            if (identifierHasValue(element)) {
                if (blankOrNull(element.identifier)) errIdentifiers[index] = true;
            }
        });
        errors["relatedIdentifiers"] = errIdentifiers;

        this.setState({ errors });

        let hasError = false;
        Object.keys(errors).forEach(key => {
            if (typeof errors[key] === "object") {
                Object.keys(errors[key]).forEach(nestedKey => {
                    if (errors[key][nestedKey] === true) {
                        hasError = true;
                    }
                });
            } else if (errors[key] === true) {
                hasError = true;
            }
        });

        return hasError;
    }


    addRow(e, key) {
        e.preventDefault();
        this.setState(() => ({ [key]: this.state[key].concat([""]) }));
    }

    addCollaborator(e) {
        e.preventDefault();
        this.setState(() => ({ contributors: this.state.contributors.concat(newCollaborator()) }));
    }

    addSubject(e) {
        e.preventDefault();
        this.setState(() => ({ subjects: this.state.subjects.concat(newSubject()) }));
    }

    addIdentifier(e) {
        e.preventDefault();
        this.setState(() => ({ relatedIdentifiers: this.state.relatedIdentifiers.concat(newIdentifier()) }));
    }

    setStateEv(key) {
        return (e, { value }) => {
            this.setState(() => ({ [key]: value }));
        };
    }

    setStateEvList(key) {
        return (value, index, member) => {
            const list = this.state[key];
            if (!!member) list[index][member] = value;
            else list[index] = value;
            this.setState(() => ({ [key]: list }));
        };
    }

    render() {
        return (
            <Form onSubmit={this.onSubmit}>
                <Form.Field required>
                    <label>Title</label>
                    <Form.Input
                        placeholder="Title"
                        value={this.state.title}
                        error={this.state.errors.title}
                        onChange={this.setStateEv("title")}
                        required
                    />
                </Form.Field>
                <Form.Field required>
                    <label>Description</label>
                    <Form.TextArea
                        value={this.state.description}
                        error={this.state.errors.description}
                        rows={15}
                        placeholder="Description"
                        onChange={this.setStateEv("description")}
                        required
                    />
                </Form.Field>
                <Form.Field>
                    <label>License</label>
                    <p>
                        {this.state.license ?
                            <span>
                                Selected
                                {" "}
                                <a href={this.state.license.link}>
                                    {this.state.license.title}
                                </a>

                                <Button
                                    type="button"
                                    basic
                                    onClick={() => this.setState({ license: null })}
                                    icon="remove"
                                    size="tiny"
                                    floated="right"
                                />
                            </span>

                            :

                            <span>
                                No license selected
                            </span>
                        }
                    </p>
                    <LicenseDropdown onChange={this.setStateEv("license")} />
                </Form.Field>

                <Form.Field>
                    <label>Keywords</label>
                    <FormFieldList
                        items={this.state.keywords}
                        name="keyword"
                        onChange={this.setStateEvList("keywords")}
                    />
                    <Button
                        type="button"
                        content="New keyword"
                        onClick={(e) => this.addRow(e, "keywords")}
                    />
                </Form.Field>

                <Form.Field>
                    <label>Notes</label>
                    <Form.TextArea
                        value={this.state.notes}
                        placeholder="Notes..."
                        onChange={this.setStateEv("notes")}
                    />
                </Form.Field>

                <Form.Field>
                    <label>Contributors</label>
                    <Contributors
                        contributors={this.state.contributors}
                        errors={this.state.errors.contributors}
                        onChange={this.setStateEvList("contributors")}
                    />
                    <Button
                        type="button"
                        content="Add collaborator"
                        onClick={(e) => this.addCollaborator(e)}
                    />
                </Form.Field>

                <Form.Field>
                    <label>References</label>
                    <FormFieldList
                        name="reference"
                        items={this.state.references}
                        onChange={this.setStateEvList("references")}
                    />
                    <Button
                        type="button"
                        content="Add reference"
                        onClick={(e) => this.addRow(e, "references")}
                    />
                </Form.Field>

                <Form.Field>
                    <label>Subjects</label>
                    <Subjects
                        subjects={this.state.subjects}
                        onChange={this.setStateEvList("subjects")}
                        errors={this.state.errors.subjects}
                    />
                    <Button
                        type="button"
                        content="Add subject"
                        onClick={(e) => this.addSubject(e)}
                    />
                </Form.Field>

                <Form.Field>
                    <label>Related identifiers</label>

                    <RelatedIdentifiers
                        relatedIdentifiers={this.state.relatedIdentifiers}
                        onChange={this.setStateEvList("relatedIdentifiers")}
                        errors={this.state.errors.relatedIdentifiers}
                    />
                    <Button
                        type="button"
                        content="Add identifier"
                        onClick={(e) => this.addIdentifier(e)}
                    />
                </Form.Field>

                <Button
                    positive
                    type="button"
                    content="Submit"
                    floated="right"
                    icon="checkmark"
                    onClick={(e) => this.onSubmit(e)}
                />
                <div className="clear"></div>
            </Form>
        )
    }
}

interface LicenseDropdownProps {
    onChange: (ev, details) => void
}

interface LicenseDropdownState {
    isLoading: boolean
    value: string
    results: { title: string, identifier: string, link: string }[]
}

class LicenseDropdown extends React.Component<LicenseDropdownProps, LicenseDropdownState> {
    constructor(props: any) {
        super(props)

        this.state = { isLoading: false, value: "", results: [] };
    }

    handleSearchChange(value) {
        this.setState({ isLoading: true, value });
        setTimeout(() => {
            const results = allLicenses
                .filter(e => e.name.toLowerCase().indexOf(value.toLowerCase()) !== -1)
                .map(e => ({ title: e.name, identifier: e.identifier, link: e.link }));

            this.setState({ isLoading: false, results });
        }, 0);
    }

    render() {
        return (
            <Search
                placeholder="Search for a license..."
                loading={false}
                onResultSelect={(e, { result }) => this.props.onChange(e, { value: result })}
                onSearchChange={(e, { value }) => this.handleSearchChange(value)}
                results={this.state.results}
                value={this.state.value}
            />
        );
    }
}

interface SubjectsProps {
    subjects: Subject[]
    onChange: (value, index: number, key: string) => void
    errors: any
}

const Subjects = ({ subjects, errors, onChange }: SubjectsProps) => {
    const elements = subjects.map((value, index) => {
        const sharedProps = { value, onChange, index };
        return <Form.Group key={index} widths="equal">
            <InputInList name="term" displayName="Term" error={errors[index]}
                {...sharedProps} />
            <InputInList name="identifier" displayName="Identifier" {...sharedProps} />
        </Form.Group>;
    });
    return <React.Fragment>{elements}</React.Fragment>;
};

interface RelatedIdentifiersProps {
    relatedIdentifiers: RelatedIdentifier[]
    onChange: (value, index: number, key: string) => void
    errors: any
}

const RelatedIdentifiers = ({ relatedIdentifiers, errors, onChange }: RelatedIdentifiersProps) => {
    const elements = relatedIdentifiers.map((value, index) => {
        const sharedProps = { value, onChange, index };
        return <Form.Group key={index} widths="equal">
            <InputInList name="identifier" displayName="Identifier" error={errors[index]}
                {...sharedProps} />

            <Form.Dropdown label="Type"
                search
                searchInput={{ type: "string" }}
                selection
                options={identifierTypes}
                value={value.relation}
                placeholder="Select type"
                onChange={(e, { value }) => onChange(value, index, "relation")}
            />
        </Form.Group>;
    });

    return <React.Fragment>{elements}</React.Fragment>;
};

interface CollaboratorsProps {
    contributors: Creator[]
    onChange: (value, index: number, key: string) => void
    errors: any
}

const Contributors = ({ contributors, errors, onChange }: CollaboratorsProps) =>
    <React.Fragment>
        {
            contributors.map((value, index) => {
                const sharedProps = { value, onChange, index };

                return <Form.Group key={index} widths="equal">
                    <InputInList name="name" displayName="Name" {...sharedProps}
                        error={errors[index]} />
                    <InputInList name="affiliation" displayName="Affiliation" {...sharedProps} />
                    <InputInList name="orcId" displayName="ORCID" {...sharedProps} />
                    <InputInList name="gnd" displayName="GND" {...sharedProps} />
                </Form.Group>
            })
        }
    </React.Fragment>

const InputInList = (p: {
    name: string,
    value: any,
    displayName: string,
    index: number,
    onChange: (value, i: number, name: string) => void,
    error?: any
}) => (
        <Form.Input
            fluid
            label={p.displayName}
            placeholder={`${p.displayName}...`}
            value={p.value[p.name]}
            onChange={(e, { value }) => p.onChange(value, p.index, p.name)}
            error={p.error}
        />
    );

const FormFieldList = ({ items, name, onChange }) =>
    <React.Fragment>
        {
            items.map((c, i) =>
                <Form.Input
                    key={i}
                    value={c}
                    placeholder={`Enter ${name}`}
                    onChange={(e, { value }) => onChange(value, i)}
                />)
        }
    </React.Fragment>;


const blankOrNull = (value: string): boolean => {
    return value == null || value.length == 0 || /^\s*$/.test(value);
}