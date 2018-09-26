import * as React from "react";
import RunApp from "Applications/RunApp";
import { create } from "react-test-renderer";
import { configureStore } from "Utilities/ReduxUtilities";
import { initApplications, initUppy } from "DefaultObjects";
import applications from "Applications/Redux/ApplicationsReducer";
import uppy from "Uppy/Redux/UppyReducers";
import { Provider } from "react-redux";
import Cloud from "Authentication/lib";
import { MemoryRouter } from "react-router";

describe("RunApp component", () => {

    const uppyInstance = initUppy(new Cloud());

    // FIXME Requires match props, but for some reason isn't allowed
    test.skip("Mount", () => {
        const store = configureStore({ applications: initApplications(), uppy: uppyInstance }, { applications, uppy })
        expect(create(
            <Provider store={store}>
                <MemoryRouter>
                    {/* <RunApp match={{ params: { appName: "appName", appVersion: "appVersion" } }} /> */}
                </MemoryRouter>
            </Provider>).toJSON()
        ).toMatchSnapshot();
    });

});