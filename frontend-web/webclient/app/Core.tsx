import * as React from "react";

// Loadable with React Lazy
const Applications = React.lazy(() => import("Applications/Browse"));
const ApplicationsOverview = React.lazy(() => import("Applications/Overview"));
const ApplicationView = React.lazy(() => import("Applications/View"));
const AdminOverview = React.lazy(() => import("Admin/Overview"));
const App = React.lazy(() => import("Applications/Studio/Applications"));
const AvataaarModification = React.lazy(() => import("UserSettings/Avataaar"));
const Dashboard = React.lazy(() => import("Dashboard/Dashboard"));
const DetailedNews = React.lazy(() => import("NewsPost/DetailedNews"));
const FilesRouter = React.lazy(() => import("Files/Files"));
const FileCollectionsRouter = React.lazy(() => import("Files/FileCollections"));
const MetadataNamespacesRouter = React.lazy(() => import("Files/Metadata/Templates/Namespaces"));
const Shares = React.lazy(() => import("Files/Shares"));
const IngoingApplications = React.lazy(() => import("Project/Grant/IngoingApplications"));
const JobShell = React.lazy(() => import("Applications/Jobs/Shell"));
const JobWeb = React.lazy(() => import("Applications/Jobs/Web"));
const JobVnc = React.lazy(() => import("Applications/Jobs/Vnc"));
const LandingPage = React.lazy(() => import("Project/Grant/LandingPage"));
const LicenseServers = React.lazy(() => import("Admin/LicenseServers"));
const LoginPage = React.lazy(() => import("Login/Login"));
const LoginSelection = React.lazy(() => import("Login/LoginSelection"));
const NewsList = React.lazy(() => import("NewsPost/NewsList"));
const NewsManagement = React.lazy(() => import("Admin/NewsManagement"));
const OutgoingApplications = React.lazy(() => import("Project/Grant/OutgoingApplications"));
const Playground = React.lazy(() => import("Playground/Playground"));
const Products = React.lazy(() => import("Products/Products"));
const ProjectBrowser = React.lazy(() => import("Project/Grant/ProjectBrowser"));
const ProjectDashboard = React.lazy(() => import("Project/ProjectDashboard"));
const ProjectList = React.lazy(() => import("Project/ProjectList"));
const ProjectMembers = React.lazy(() => import("Project/Members"));
const ProjectSettings = React.lazy(() => import("Project/ProjectSettings"));
const ProjectResources = React.lazy(() => import("Project/Resources"));
const Search = React.lazy(() => import("Search/Search"));
const ServiceLicenseAgreement = React.lazy(() => import("ServiceLicenseAgreement"));
const Studio = React.lazy(() => import("Applications/Studio/Page"));
const Tool = React.lazy(() => import("Applications/Studio/Tool"));
const UserCreation = React.lazy(() => import("Admin/UserCreation"));
const UserSettings = React.lazy(() => import("UserSettings/UserSettings"));
const Wayf = React.lazy(() => import("Login/Wayf"));
const AppK8Admin = React.lazy(() => import("Admin/AppK8Admin"));
const AppAauAdmin = React.lazy(() => import("Admin/AppAauAdmin"));
const Demo = React.lazy(() => import("Playground/Demo"));
const LagTest = React.lazy(() => import("Playground/LagTest"));
const Providers = React.lazy(() => import("Admin/Providers/Browse"));
const CreateProvider = React.lazy(() => import("Admin/Providers/Create"));
const RegisterProvider = React.lazy(() => import("Admin/Providers/Approve"));
const ViewProvider = React.lazy(() => import("Admin/Providers/View"));
const ProviderConnection = React.lazy(() => import("Providers/Connect"));

const IngressRouter = React.lazy(() => import("Applications/Ingresses/Router"));
const LicenseRouter = React.lazy(() => import("Applications/Licenses"));
const NetworkIPsRouter = React.lazy(() => import("Applications/NetworkIP/Router"));

// Not React.lazy-able due to how the components are created on demand.
import {GrantApplicationEditor, RequestTarget} from "Project/Grant/GrantApplicationEditor";

// Always load.
import Sidebar from "ui-components/Sidebar";
import Uploader from "Files/Uploader";
import Snackbars from "Snackbar/Snackbars";
import Dialog from "Dialog/Dialog";
import {Route, RouteComponentProps, Switch} from "react-router-dom";
import {USER_LOGIN} from "Navigation/Redux/HeaderReducer";
import {inDevEnvironment} from "UtilityFunctions";
import {History} from "history";
import {ErrorBoundary} from "ErrorBoundary/ErrorBoundary";
import {dispatchUserAction, onLogin} from "App";
import {MainContainer} from "MainContainer/MainContainer";
import {Client} from "Authentication/HttpClientInstance";
import CONF from "../site.config.json";
import JobRouter from "Applications/Jobs/NewApi";
import {Debugger} from "Debug/Debugger";

const NotFound = (): JSX.Element => (<MainContainer main={<div><h1>Not found.</h1></div>} />);

const Core = (): JSX.Element => (
    <>
        <Dialog />
        <Snackbars />
        <Uploader />
        <Sidebar />
        <ErrorBoundary>
            <React.Suspense fallback={<div>Loading</div>}>
                <Switch>
                    <Route exact path="/login" component={LoginPage} />
                    {inDevEnvironment() || window.location.host === CONF.DEV_SITE ?
                        <Route exact path="/login/selection" component={LoginSelection} /> :
                        <Route exact path="/login/selection" component={LoginPage} />
                    }
                    <Route exact path="/loginSuccess" component={LoginSuccess} />
                    <Route exact path="/login/wayf" component={Wayf} />
                    <Route exact path="/" component={requireAuth(Dashboard)} />
                    <Route exact path="/dashboard" component={requireAuth(Dashboard)} />
                    <Route exact path={"/debugger"} component={Debugger} />

                    <Route path={"/drives"}><FileCollectionsRouter /></Route>
                    <Route path={"/files"}><FilesRouter /></Route>
                    <Route path={"/metadata"}><MetadataNamespacesRouter /></Route>
                    <Route exact path="/shares" component={requireAuth(Shares)} />

                    <Route exact path="/applications" component={requireAuth(Applications)} />
                    <Route exact path="/applications/overview" component={requireAuth(ApplicationsOverview)} />
                    <Route
                        exact
                        path="/applications/details/:appName/:appVersion"
                        component={requireAuth(ApplicationView)}
                    />

                    <Route exact path="/applications/shell/:jobId/:rank" component={JobShell} />
                    <Route exact path="/applications/web/:jobId/:rank" component={JobWeb} />
                    <Route exact path="/applications/vnc/:jobId/:rank" component={JobVnc} />
                    <Route path="/public-links"><IngressRouter /></Route>
                    <Route path="/jobs"><JobRouter /></Route>
                    <Route path="/licenses"><LicenseRouter /></Route>
                    <Route path="/public-ips"><NetworkIPsRouter /></Route>

                    <Route exact path="/applications/studio" component={requireAuth(Studio)} />
                    <Route exact path="/applications/studio/t/:name" component={requireAuth(Tool)} />
                    <Route exact path="/applications/studio/a/:name" component={requireAuth(App)} />

                    {!inDevEnvironment() ? null : <Route exact path={"/playground"} component={Playground} />}
                    {!inDevEnvironment() ? null : <Route exact path={"/playground/demo"} component={Demo} />}
                    {!inDevEnvironment() ? null : <Route exact path={"/playground/lag"} component={LagTest} />}

                    <Route exact path="/admin" component={requireAuth(AdminOverview)} />
                    <Route exact path="/admin/userCreation" component={requireAuth(UserCreation)} />
                    <Route exact path="/admin/licenseServers" component={requireAuth(LicenseServers)} />
                    <Route exact path="/admin/news" component={requireAuth(NewsManagement)} />
                    <Route exact path="/admin/appk8" component={requireAuth(AppK8Admin)} />
                    <Route exact path="/admin/appaau" component={requireAuth(AppAauAdmin)} />
                    <Route exact path="/admin/providers" component={requireAuth(Providers)} />
                    <Route exact path="/admin/providers/create" component={requireAuth(CreateProvider)} />
                    <Route exact path="/admin/providers/register" component={requireAuth(RegisterProvider)} />
                    <Route exact path="/admin/providers/view/:id" component={requireAuth(ViewProvider)} />

                    <Route exact path="/news/detailed/:id" component={DetailedNews} />
                    <Route exact path="/news/list/:filter?" component={NewsList} />

                    <Route
                        exact
                        path="/users/settings"
                        component={requireAuth(UserSettings, {requireTwoFactor: false})}
                    />
                    <Route exact path="/users/avatar" component={requireAuth(AvataaarModification)} />

                    <Route exact path="/search/:priority" component={requireAuth(Search)} />

                    <Route exact path="/skus" component={Products} />

                    <Route exact path="/projects" component={requireAuth(ProjectList)} />
                    <Route exact path="/project/dashboard" component={requireAuth(ProjectDashboard)} />
                    <Route exact path="/project/settings/:page?" component={requireAuth(ProjectSettings)} />
                    <Route exact path="/project/resources" component={requireAuth(ProjectResources)} />
                    <Route
                        exact
                        path="/project/grants-landing"
                        component={requireAuth(LandingPage)}
                    />
                    <Route
                        exact
                        path="/project/grants/existing"
                        component={requireAuth(GrantApplicationEditor(RequestTarget.EXISTING_PROJECT))}
                    />
                    <Route
                        exact
                        path="/project/grants/personal/:projectId"
                        component={requireAuth(GrantApplicationEditor(RequestTarget.PERSONAL_PROJECT))}
                    />
                    <Route
                        exact
                        path="/project/grants/new/:projectId"
                        component={requireAuth(GrantApplicationEditor(RequestTarget.NEW_PROJECT))}
                    />
                    <Route
                        exact
                        path="/project/grants/view/:appId"
                        component={requireAuth(GrantApplicationEditor(RequestTarget.VIEW_APPLICATION))}
                    />
                    <Route
                        exact
                        path="/project/members/:group?/:member?"
                        component={requireAuth(ProjectMembers)}
                    />
                    <Route exact path="/project/grants/ingoing" component={requireAuth(IngoingApplications)} />
                    <Route exact path="/project/grants/outgoing" component={requireAuth(OutgoingApplications)} />
                    <Route exact path="/projects/browser/:action" component={requireAuth(ProjectBrowser)} />

                    <Route exact path={"/providers/connect"} component={requireAuth(ProviderConnection)} />

                    <Route
                        exact
                        path="/sla"
                        component={requireAuth(ServiceLicenseAgreement, {requireTwoFactor: false, requireSla: false})}
                    />
                    <Route component={NotFound} />
                </Switch>
            </React.Suspense>
        </ErrorBoundary>
    </>
);

interface RequireAuthOpts {
    requireTwoFactor?: boolean;
    requireSla?: boolean;
}

function requireAuth<T>(Delegate: React.FunctionComponent<T>, opts?: RequireAuthOpts): React.FunctionComponent<T> {
    return function Auth(props: T & RouteComponentProps) {
        const info = Client.userInfo;
        if (!Client.isLoggedIn || info === undefined) {
            props.history.push("/login");
            return null;
        }

        if (opts === undefined || opts.requireSla !== false) {
            if (info.serviceLicenseAgreement === false) {
                props.history.push("/sla");
                return null;
            }
        }

        if (opts === undefined || opts.requireTwoFactor) {
            if (info.principalType === "password" && Client.userRole === "USER" &&
                info.twoFactorAuthentication === false) {
                props.history.push("/users/settings");
                return null;
            }
        }

        return <Delegate {...props} />;
    };
}

const LoginSuccess = (props: {history: History}): null => {
    dispatchUserAction(USER_LOGIN);
    onLogin();
    props.history.push("/");
    return null;
};

export default Core;
