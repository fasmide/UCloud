import React from 'react';
import {BallPulseLoading} from '../LoadingIcon'
import {WebSocketSupport, toLowerCaseAndCapitalize} from '../../UtilityFunctions'
import pubsub from "pubsub-js";
import {Cloud} from "../../../authentication/SDUCloudObject";
import {Card} from "../Cards";
import {Table} from 'react-bootstrap';
import {Link} from "react-router-dom";
import {PaginationButtons, EntriesPerPageSelector} from "../Pagination"
import PromiseKeeper from "../../PromiseKeeper";

class Analyses extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            promises: new PromiseKeeper(),
            analyses: [],
            loading: false,
            currentPage: 0,
            analysesPerPage: 10,
            totalPages: () => Math.ceil(this.state.analyses.length / this.state.analysesPerPage),
            reloadIntervalId: -1
        };
        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.toPage = this.toPage.bind(this);
        this.handlePageSizeSelection = this.handlePageSizeSelection.bind(this);
        this.getCurrentAnalyses = this.getCurrentAnalyses.bind(this);
    }

    componentDidMount() {
        pubsub.publish('setPageTitle', this.constructor.name);
        this.getAnalyses(false);
        let reloadIntervalId = setInterval(() => {
            this.getAnalyses(true)
        }, 10000);
        this.setState({reloadIntervalId: reloadIntervalId});
    }

    componentWillUnmount() {
        clearInterval(this.state.reloadIntervalId);
        this.state.promises.cancelPromises();
    }

    getAnalyses(silent) {
        if (!silent) {
            this.setState({
                loading: true
            });
        }

        this.state.promises.makeCancelable(Cloud.get("/hpc/jobs")).promise.then(req => {
            this.setState(() => ({
                loading: false,
                analyses: req.response.items,
            }));
        });
    }

    getCurrentAnalyses() {
        let analysesPerPage = this.state.analysesPerPage;
        let currentPage = this.state.currentPage;
        return this.state.analyses.slice(currentPage * analysesPerPage, currentPage * analysesPerPage + analysesPerPage);
    }

    handlePageSizeSelection(newPageSize) {
        this.setState(() => ({
            analysesPerPage: newPageSize,
        }));
    }

    toPage(n) {
        this.setState(() => ({
            currentPage: n,
        }));
    }

    nextPage() {
        this.setState(() => ({
            currentPage: this.state.currentPage + 1,
        }));
    }

    previousPage() {
        this.setState(() => ({
            currentPage: this.state.currentPage - 1,
        }));
    }

    render() {
        const noAnalysis = this.state.analyses.length ? '' : <h3 className="text-center">
            <small>No analyses found.</small>
        </h3>;

        return (
            <section>
                <div className="container-fluid">
                    <div>
                        <BallPulseLoading loading={this.state.loading}/>
                        <Card>
                            <WebSocketSupport/>
                            {noAnalysis}
                            <div className="card-body">
                                <Table responsive className="table table-hover mv-lg">
                                    <thead>
                                    <tr>
                                        <th>App Name</th>
                                        <th>Job Id</th>
                                        <th>Status</th>
                                        <th>Started at</th>
                                        <th>Last updated at</th>
                                    </tr>
                                    </thead>
                                    <AnalysesList analyses={this.getCurrentAnalyses()}/>
                                </Table>
                            </div>
                        </Card>
                        <PaginationButtons entriesPerPage={this.state.analysesPerPage} totalEntries={this.state.analyses.length}
                                           currentPage={this.state.currentPage}
                                           toPage={this.toPage} nextPage={this.nextPage}
                                           previousPage={this.previousPage}/>
                        <EntriesPerPageSelector entriesPerPage={this.state.analysesPerPage}
                                                handlePageSizeSelection={this.handlePageSizeSelection}/>
                    </div>
                </div>
            </section>
        )
    }
}

const AnalysesList = (props) => {
    if (!props.analyses && !props.analyses[0].name) {
        return null;
    }
    const analysesList = props.analyses.map((analysis, index) => {
            const jobIdField = analysis.status === "COMPLETE" ?
                (<Link to={`/files/${Cloud.jobFolder}/${analysis.jobId}`}>{analysis.jobId}</Link>) : analysis.jobId;
            return (
                <tr key={index} className="gradeA row-settings">
                    <td><Link
                        to={`/applications/${analysis.appName}/${analysis.appVersion}`}>{analysis.appName}@{analysis.appVersion}</Link>
                    </td>
                    <td>{jobIdField}</td>
                    <td>{toLowerCaseAndCapitalize(analysis.status)}</td>
                    <td>{formatDate(analysis.createdAt)}</td>
                    <td>{formatDate(analysis.modifiedAt)}</td>
                </tr>)
        }
    );
    return (
        <tbody>
        {analysesList}
        </tbody>)
};

const formatDate = (millis) => {
    // TODO Very primitive
    let d = new Date(millis);
    return `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${pad(d.getFullYear(), 2)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`
};

const pad = (value, length) => (value.toString().length < length) ? pad("0" + value, length) : value;

export default Analyses
